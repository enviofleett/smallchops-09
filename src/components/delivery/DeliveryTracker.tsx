import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Clock, Phone, Truck, Package, CheckCircle, Circle } from 'lucide-react';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { toast } from 'sonner';

export const DeliveryTracker = () => {
  const [searchValue, setSearchValue] = useState('');
  const { tracking, loading, error, trackOrder } = useDeliveryTracking();

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

  const getTrackingSteps = (status: string, orderType: 'delivery' | 'pickup') => {
    const steps = [
      { key: 'pending', label: 'Order Placed', icon: Package },
      { key: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
      { key: 'preparing', label: 'Preparing', icon: Clock },
    ];

    if (orderType === 'delivery') {
      steps.push(
        { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
        { key: 'delivered', label: 'Delivered', icon: CheckCircle }
      );
    } else {
      steps.push(
        { key: 'ready', label: 'Ready for Pickup', icon: CheckCircle },
        { key: 'delivered', label: 'Picked Up', icon: CheckCircle }
      );
    }

    return steps;
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Track Your Order
          </CardTitle>
          <CardDescription>
            Enter your order number or ID to track your delivery
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

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

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
                      {tracking.riderInfo.phone}
                    </p>
                  )}
                  <p><span className="font-medium">Vehicle:</span> {tracking.riderInfo.vehicleInfo}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-4">Order Progress</h4>
              <div className="space-y-4">
                {getTrackingSteps(tracking.status, 'delivery').map((step, index) => {
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};