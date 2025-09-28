import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Clock, Phone, Truck, Package, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { toast } from 'sonner';
import { getRecentGuestOrder, cleanupGuestOrderTracking, logGuestTrackingEvent } from '@/utils/guestCheckoutTracker';

interface GuestOrderTrackerProps {
  className?: string;
  autoPopulate?: boolean;
}

export const GuestOrderTracker = ({ className, autoPopulate = true }: GuestOrderTrackerProps) => {
  const [searchValue, setSearchValue] = useState('');
  const { tracking, loading, error, trackOrder } = useDeliveryTracking();

  // Auto-populate from recent guest checkout
  useEffect(() => {
    if (autoPopulate && !searchValue) {
      const guestOrder = getRecentGuestOrder(10); // 10 minute window for auto-population
      
      if (guestOrder.orderIdentifier) {
        setSearchValue(guestOrder.orderIdentifier);
        trackOrder(guestOrder.orderIdentifier);
        
        toast.success(`Found your recent order: ${guestOrder.orderIdentifier}`, {
          description: 'Tracking your order from checkout'
        });
        
        logGuestTrackingEvent('auto_populated', {
          orderIdentifier: guestOrder.orderIdentifier,
          source: guestOrder.source
        });
        
        if (guestOrder.shouldCleanup) {
          cleanupGuestOrderTracking(guestOrder.source!);
        }
      }
    }
  }, [autoPopulate, searchValue, trackOrder]);

  const handleTrackOrder = async () => {
    if (!searchValue.trim()) {
      toast.error('Please enter an order number');
      return;
    }
    await trackOrder(searchValue.trim());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning text-warning-foreground';
      case 'confirmed':
        return 'bg-primary text-primary-foreground';
      case 'preparing':
        return 'bg-accent text-accent-foreground';
      case 'ready':
      case 'out_for_delivery':
        return 'bg-secondary text-secondary-foreground';
      case 'delivered':
        return 'bg-success text-success-foreground';
      case 'cancelled':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTrackingSteps = (status: string, orderType: 'delivery' | 'pickup' = 'delivery') => {
    const steps = [
      { key: 'pending', label: 'Order Placed', icon: Package, description: 'Your order has been received' },
      { key: 'confirmed', label: 'Order Confirmed', icon: CheckCircle, description: 'Payment verified and confirmed' },
      { key: 'preparing', label: 'Preparing', icon: Clock, description: 'Your order is being prepared' },
    ];

    if (orderType === 'delivery') {
      steps.push(
        { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, description: 'Your order is on the way' },
        { key: 'delivered', label: 'Delivered', icon: CheckCircle, description: 'Order delivered successfully' }
      );
    } else {
      steps.push(
        { key: 'ready', label: 'Ready for Pickup', icon: CheckCircle, description: 'Your order is ready' },
        { key: 'delivered', label: 'Picked Up', icon: CheckCircle, description: 'Order picked up successfully' }
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
    <div className={`space-y-6 ${className}`}>
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Your Order
          </CardTitle>
          <CardDescription>
            Enter your order number to track your delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter order number (e.g., ORD-1234567890)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
              className="flex-1"
            />
            <Button onClick={handleTrackOrder} disabled={loading}>
              {loading ? 'Tracking...' : 'Track Order'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Failed to track order</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tracking Results */}
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
            {/* Estimated Delivery Time */}
            {tracking.estimatedDeliveryTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Estimated delivery: {new Date(tracking.estimatedDeliveryTime).toLocaleString()}
              </div>
            )}

            {/* Rider Information */}
            {tracking.riderInfo && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rider:</span>
                    <span className="font-medium">{tracking.riderInfo.name}</span>
                  </div>
                  {tracking.riderInfo.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {tracking.riderInfo.phone}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span>{tracking.riderInfo.vehicleInfo}</span>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Order Progress */}
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Order Progress
              </h4>
              <div className="space-y-4">
                {getTrackingSteps(tracking.status, 'delivery').map((step, index) => {
                  const currentStatusOrder = getStatusOrder(tracking.status);
                  const stepOrder = getStatusOrder(step.key);
                  const isCompleted = stepOrder <= currentStatusOrder;
                  const isCurrent = stepOrder === currentStatusOrder;
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className={`
                        rounded-full p-2 mt-0.5
                        ${isCompleted 
                          ? 'bg-primary text-primary-foreground' 
                          : isCurrent 
                            ? 'bg-primary/20 text-primary border border-primary' 
                            : 'bg-muted text-muted-foreground'
                        }
                      `}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${isCompleted ? 'text-primary' : ''}`}>
                          {step.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-primary font-medium mt-1">Current status</p>
                        )}
                      </div>
                      {isCompleted && (
                        <CheckCircle className="h-4 w-4 text-primary mt-1" />
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