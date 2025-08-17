import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Package, Truck, Phone } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduleDisplayTestProps {
  orderType: 'delivery' | 'pickup';
  scheduledDate: string;
  timeStart: string;
  timeEnd: string;
  pickupPoint?: {
    name: string;
    address: string;
    contact_phone?: string;
  };
  deliveryZone?: string;
}

export const ScheduleDisplayTest: React.FC<ScheduleDisplayTestProps> = ({
  orderType,
  scheduledDate,
  timeStart,
  timeEnd,
  pickupPoint,
  deliveryZone,
}) => {
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return format(date, 'h:mm a');
    } catch {
      return timeString;
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {orderType === 'delivery' ? (
            <Truck className="h-5 w-5" />
          ) : (
            <Package className="h-5 w-5" />
          )}
          {orderType === 'delivery' ? 'Delivery Information' : 'Pickup Information'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Fulfillment Channel */}
          <div>
            <div className="flex items-center gap-2">
              {orderType === 'delivery' ? (
                <Truck className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Fulfillment Channel</p>
                <p className="font-medium">
                  {orderType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                </p>
              </div>
            </div>
          </div>

          {/* Pickup Point Information */}
          {orderType === 'pickup' && pickupPoint && (
            <div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Pickup Location</p>
                  <p className="font-medium">{pickupPoint.name}</p>
                  <p className="text-sm text-muted-foreground break-words">{pickupPoint.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Zone */}
          {orderType === 'delivery' && deliveryZone && (
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Delivery Zone</p>
                  <p className="font-medium break-words">{deliveryZone}</p>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Information */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Date
                    </p>
                    <p className="font-medium">
                      {new Date(scheduledDate).toLocaleDateString('en-NG', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Time Window
                    </p>
                    <p className="font-medium">
                      {formatTime(timeStart)} - {formatTime(timeEnd)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          {pickupPoint?.contact_phone && (
            <div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Phone</p>
                  <p className="font-medium">{pickupPoint.contact_phone}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};