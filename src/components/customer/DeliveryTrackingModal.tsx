import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Truck, 
  Clock, 
  Phone, 
  Navigation,
  Package,
  CheckCircle,
  User,
  X,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeliveryTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
}

interface TrackingData {
  status: string;
  estimatedArrival: string;
  currentLocation: string;
  driverName: string;
  driverPhone: string;
  driverPhoto?: string;
  vehicleInfo: string;
  trackingSteps: {
    status: string;
    timestamp: string;
    description: string;
    completed: boolean;
  }[];
}

// Helper to fetch live tracking data
const fetchOrderTrackingData = async (orderId: string): Promise<TrackingData | null> => {
  try {
    // Fetch order with driver information
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        assigned_rider_id,
        audit_logs (
          created_at,
          action,
          details,
          metadata
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !orderData) {
      console.error('Failed to fetch order data:', orderError);
      return null;
    }

    // Fetch driver information if assigned
    let driverData = null;
    if (orderData.assigned_rider_id) {
      const { data: driver, error: driverError } = await supabase
        .from('delivery_riders')
        .select('*')
        .eq('id', orderData.assigned_rider_id)
        .maybeSingle();

      if (!driverError && driver) {
        driverData = driver;
      }
    }

    // Build tracking steps from order status and audit logs
    const trackingSteps = buildTrackingSteps(orderData);

    // Determine current location and ETA based on status
    const { currentLocation, estimatedArrival } = getLocationAndETA(orderData, driverData);

    return {
      status: orderData.status || 'pending',
      estimatedArrival,
      currentLocation,
      driverName: driverData?.name || 'Driver not assigned',
      driverPhone: driverData?.phone || '',
      driverPhoto: driverData?.photo_url || '',
      vehicleInfo: driverData?.vehicle_info || 'Vehicle info not available',
      trackingSteps
    };
  } catch (error) {
    console.error('Error fetching tracking data:', error);
    return null;
  }
};

// Helper to build tracking steps from order data
const buildTrackingSteps = (orderData: any) => {
  const steps = [
    {
      status: 'confirmed',
      timestamp: orderData.created_at || new Date().toISOString(),
      description: 'Order confirmed and being prepared',
      completed: ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status)
    },
    {
      status: 'preparing',
      timestamp: orderData.status === 'preparing' ? (orderData.updated_at || orderData.created_at) : '',
      description: 'Kitchen started preparing your order',
      completed: ['preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status)
    },
    {
      status: 'ready',
      timestamp: orderData.status === 'ready' ? (orderData.updated_at || '') : '',
      description: 'Order ready for pickup',
      completed: ['ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status)
    },
    {
      status: 'out_for_delivery',
      timestamp: orderData.status === 'out_for_delivery' ? (orderData.updated_at || '') : '',
      description: 'Driver picked up your order',
      completed: ['out_for_delivery', 'delivered', 'completed'].includes(orderData.status)
    },
    {
      status: 'delivered',
      timestamp: orderData.status === 'delivered' || orderData.status === 'completed' ? (orderData.updated_at || '') : '',
      description: 'Order delivered to your location',
      completed: ['delivered', 'completed'].includes(orderData.status)
    }
  ];

  return steps;
};

// Helper to determine location and ETA
const getLocationAndETA = (orderData: any, driverData: any) => {
  let currentLocation = 'Processing at kitchen';
  let estimatedArrival = 'Calculating...';

  switch (orderData.status) {
    case 'preparing':
      currentLocation = 'Kitchen - Order being prepared';
      estimatedArrival = '20-30 minutes';
      break;
    case 'ready':
      currentLocation = 'Kitchen - Ready for pickup';
      estimatedArrival = '10-15 minutes';
      break;
    case 'out_for_delivery':
      currentLocation = driverData?.current_location || 'On the way to you';
      estimatedArrival = '10-20 minutes';
      break;
    case 'delivered':
    case 'completed':
      currentLocation = 'Delivered';
      estimatedArrival = 'Completed';
      break;
    default:
      currentLocation = 'Processing';
      estimatedArrival = '30-45 minutes';
  }

  return { currentLocation, estimatedArrival };
};

export function DeliveryTrackingModal({ 
  isOpen, 
  onClose, 
  orderId, 
  orderNumber 
}: DeliveryTrackingModalProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      setIsLoading(true);
      setError(null);

      fetchOrderTrackingData(orderId)
        .then((data) => {
          if (data) {
            setTrackingData(data);
          } else {
            setError('Unable to load tracking information');
          }
        })
        .catch((err) => {
          console.error('Error loading tracking data:', err);
          setError('Failed to load tracking information');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, orderId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'preparing':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'ready':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'out_for_delivery':
        return <Truck className="w-5 h-5 text-purple-600" />;
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const callDriver = () => {
    if (trackingData?.driverPhone) {
      window.open(`tel:${trackingData.driverPhone}`);
    } else {
      toast.error('Driver phone number not available');
    }
  };

  const refreshTracking = async () => {
    if (!orderId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchOrderTrackingData(orderId);
      if (data) {
        setTrackingData(data);
        toast.success('Tracking information updated');
      } else {
        setError('Unable to refresh tracking information');
      }
    } catch (err) {
      console.error('Error refreshing tracking:', err);
      setError('Failed to refresh tracking information');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Track Order {orderNumber}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-24 bg-muted animate-pulse rounded" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                onClick={refreshTracking}
                className="mr-2"
              >
                Retry
              </Button>
              <Button 
                variant="secondary" 
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        ) : trackingData ? (
          <div className="space-y-6">
            {/* Current Status */}
            <Card className={`border-2 ${
              trackingData.status === 'delivered' || trackingData.status === 'completed' 
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className={`w-5 h-5 ${
                      trackingData.status === 'delivered' || trackingData.status === 'completed'
                        ? 'text-green-600' 
                        : 'text-blue-600'
                    }`} />
                    <span className={`font-medium ${
                      trackingData.status === 'delivered' || trackingData.status === 'completed'
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-blue-900 dark:text-blue-100'
                    }`}>
                      {trackingData.status === 'delivered' || trackingData.status === 'completed'
                        ? 'Order delivered!'
                        : trackingData.status === 'out_for_delivery'
                        ? 'Your order is on the way!'
                        : 'Order in progress'
                      }
                    </span>
                  </div>
                  <Badge variant="secondary">
                    ETA: {trackingData.estimatedArrival}
                  </Badge>
                </div>
                <div className={`flex items-center gap-2 text-sm ${
                  trackingData.status === 'delivered' || trackingData.status === 'completed'
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  <MapPin className="w-4 h-4" />
                  <span>Current location: {trackingData.currentLocation}</span>
                </div>
              </CardContent>
            </Card>

            {/* Driver Information - Only show if driver is assigned and has contact info */}
            {trackingData.driverName && trackingData.driverName !== 'Driver not assigned' && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Your Driver</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      {trackingData.driverPhoto ? (
                        <img 
                          src={trackingData.driverPhoto} 
                          alt={trackingData.driverName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{trackingData.driverName}</p>
                      <p className="text-sm text-muted-foreground">{trackingData.vehicleInfo}</p>
                    </div>
                    {trackingData.driverPhone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={callDriver}
                        className="flex items-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        Call
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tracking Timeline */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Order Timeline</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={refreshTracking}
                    disabled={isLoading}
                  >
                    Refresh
                  </Button>
                </div>
                <div className="space-y-4">
                  {trackingData.trackingSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center border-2
                        ${step.completed 
                          ? 'bg-green-100 border-green-500 text-green-700' 
                          : 'bg-muted border-muted-foreground text-muted-foreground'
                        }
                      `}>
                        {getStatusIcon(step.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.description}
                        </p>
                        {step.timestamp && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(step.timestamp), 'PPp')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled>
                <MapPin className="w-4 h-4 mr-2" />
                View on Map
              </Button>
              {trackingData.driverPhone ? (
                <Button variant="outline" className="flex-1" onClick={callDriver}>
                  <Phone className="w-4 h-4 mr-2" />
                  Call Driver
                </Button>
              ) : (
                <Button variant="outline" className="flex-1" disabled>
                  <Phone className="w-4 h-4 mr-2" />
                  No Driver Contact
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Unable to load tracking information</p>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                onClick={refreshTracking}
                className="mr-2"
              >
                Retry
              </Button>
              <Button 
                variant="secondary" 
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}