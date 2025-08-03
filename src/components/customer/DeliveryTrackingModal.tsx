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
  X
} from 'lucide-react';
import { format } from 'date-fns';

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

export function DeliveryTrackingModal({ 
  isOpen, 
  onClose, 
  orderId, 
  orderNumber 
}: DeliveryTrackingModalProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock tracking data - in production, this would come from your delivery API
  const mockTrackingData: TrackingData = {
    status: 'out_for_delivery',
    estimatedArrival: '15-20 minutes',
    currentLocation: 'Victoria Island, Lagos',
    driverName: 'Ahmed Olatunji',
    driverPhone: '+234 812 345 6789',
    driverPhoto: '/placeholder.svg',
    vehicleInfo: 'Honda CRV - ABC 123 XY',
    trackingSteps: [
      {
        status: 'confirmed',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        description: 'Order confirmed and being prepared',
        completed: true
      },
      {
        status: 'preparing',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        description: 'Kitchen started preparing your order',
        completed: true
      },
      {
        status: 'ready',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        description: 'Order ready for pickup',
        completed: true
      },
      {
        status: 'out_for_delivery',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        description: 'Driver picked up your order',
        completed: true
      },
      {
        status: 'delivered',
        timestamp: '',
        description: 'Order delivered to your location',
        completed: false
      }
    ]
  };

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setTrackingData(mockTrackingData);
        setIsLoading(false);
      }, 1000);
    }
  }, [isOpen]);

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
        ) : trackingData ? (
          <div className="space-y-6">
            {/* Current Status */}
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      Your order is on the way!
                    </span>
                  </div>
                  <Badge variant="secondary">
                    ETA: {trackingData.estimatedArrival}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <MapPin className="w-4 h-4" />
                  <span>Current location: {trackingData.currentLocation}</span>
                </div>
              </CardContent>
            </Card>

            {/* Driver Information */}
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={callDriver}
                    className="flex items-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-4">Order Timeline</h3>
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
              <Button variant="outline" className="flex-1">
                <MapPin className="w-4 h-4 mr-2" />
                View on Map
              </Button>
              <Button variant="outline" className="flex-1" onClick={callDriver}>
                <Phone className="w-4 h-4 mr-2" />
                Call Driver
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Unable to load tracking information</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}