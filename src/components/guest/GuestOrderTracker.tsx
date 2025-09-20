import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Phone, Truck, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { useGuestSession } from '@/hooks/useGuestSession';
import { toast } from 'sonner';

export const GuestOrderTracker = () => {
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState('');
  const { guestSession } = useGuestSession();
  const { tracking, loading, error, trackOrder } = useDeliveryTracking();

  // Auto-populate from URL params (from payment success page)
  useEffect(() => {
    const orderParam = searchParams.get('order');
    const idParam = searchParams.get('id');
    
    if (orderParam) {
      setSearchValue(orderParam);
      trackOrder(orderParam);
    } else if (idParam) {
      setSearchValue(idParam);
      trackOrder(idParam);
    }
  }, [searchParams, trackOrder]);

  const handleTrackOrder = async () => {
    if (!searchValue.trim()) {
      toast.error('Please enter an order number or ID');
      return;
    }
    await trackOrder(searchValue.trim());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'confirmed':
        return 'bg-blue-500';
      case 'preparing':
        return 'bg-orange-500';
      case 'ready':
      case 'out_for_delivery':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTrackingSteps = (status: string) => {
    return [
      { key: 'pending', label: 'Order Placed', icon: Package },
      { key: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
      { key: 'preparing', label: 'Preparing', icon: Clock },
      { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
      { key: 'delivered', label: 'Delivered', icon: CheckCircle }
    ];
  };

  const getStatusOrder = (status: string): number => {
    const statusOrder: Record<string, number> = {
      'pending': 1,
      'confirmed': 2,
      'preparing': 3,
      'ready': 4,
      'out_for_delivery': 4,
      'delivered': 5,
    };
    return statusOrder[status] || 0;
  };

  return (
    <div className="space-y-6">
      {/* Guest Info Banner */}
      {guestSession && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                You're tracking as a guest. Create an account to save your order history and get faster tracking.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Track Your Order
          </CardTitle>
          <CardDescription>
            Enter your order number to track your delivery status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter order number (e.g., ORD000001)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
            />
            <Button onClick={handleTrackOrder} disabled={loading}>
              {loading ? 'Tracking...' : 'Track Order'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p>{error}</p>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>If you just placed this order:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Wait a few minutes and try again</li>
                <li>Check your email for the order confirmation</li>
                <li>Make sure you're using the correct order number</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Tracking Display */}
      {tracking && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order #{tracking.orderNumber}</CardTitle>
                <CardDescription>Order ID: {tracking.orderId}</CardDescription>
              </div>
              <Badge className={getStatusColor(tracking.status)}>
                {tracking.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {tracking.estimatedDeliveryTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Estimated delivery: {new Date(tracking.estimatedDeliveryTime).toLocaleString()}
              </div>
            )}

            {tracking.riderInfo && (
              <div className="rounded-lg border p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery Information
                </h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Rider:</span> {tracking.riderInfo.name}</p>
                  {tracking.riderInfo.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${tracking.riderInfo.phone}`} className="text-primary hover:underline">
                        {tracking.riderInfo.phone}
                      </a>
                    </p>
                  )}
                  <p><span className="font-medium">Vehicle:</span> {tracking.riderInfo.vehicleInfo}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-4">Order Progress</h4>
              <div className="space-y-4">
                {getTrackingSteps(tracking.status).map((step, index) => {
                  const currentStatusOrder = getStatusOrder(tracking.status);
                  const stepOrder = getStatusOrder(step.key);
                  const isCompleted = stepOrder <= currentStatusOrder;
                  const isCurrent = stepOrder === currentStatusOrder;
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`
                        rounded-full p-2 
                        ${isCompleted 
                          ? 'bg-primary text-primary-foreground' 
                          : isCurrent 
                            ? 'bg-primary/20 text-primary border border-primary' 
                            : 'bg-muted text-muted-foreground'
                        }
                      `}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isCompleted ? 'text-primary' : ''}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-muted-foreground">Current status</p>
                        )}
                      </div>
                      {isCompleted && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Guest Account Creation Prompt */}
            {guestSession && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-semibold mb-2">Want easier order tracking?</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Create an account to save your orders and track them anytime without entering order numbers.
                </p>
                <Button variant="outline" size="sm">
                  Create Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};