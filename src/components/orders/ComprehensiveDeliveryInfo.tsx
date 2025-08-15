import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Package, 
  Truck, 
  Store,
  Navigation,
  FileText 
} from 'lucide-react';
import { format } from 'date-fns';

interface DeliveryInfo {
  order_type: 'delivery' | 'pickup';
  delivery_address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    landmark?: string;
    contact_phone?: string;
  };
  pickup_point?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  delivery_zone?: {
    name?: string;
    delivery_fee?: number;
  };
  delivery_schedule?: {
    delivery_date?: string;
    delivery_time_start?: string;
    delivery_time_end?: string;
    special_instructions?: string;
    is_flexible?: boolean;
  };
  estimated_delivery?: string;
  tracking_reference?: string;
}

interface ComprehensiveDeliveryInfoProps {
  deliveryInfo: DeliveryInfo;
  className?: string;
  showTitle?: boolean;
}

export const ComprehensiveDeliveryInfo: React.FC<ComprehensiveDeliveryInfoProps> = ({ 
  deliveryInfo, 
  className = "",
  showTitle = true
}) => {
  const formatTime = (timeString?: string) => {
    if (!timeString) return 'Not specified';
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return format(time, 'h:mm a');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return format(new Date(dateString), 'EEEE, MMM d, yyyy');
  };

  const formatAddress = (address?: any) => {
    if (!address) return 'Not provided';
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <Card className={`border-primary/20 ${className}`}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-primary flex items-center gap-2 text-lg">
            {deliveryInfo.order_type === 'delivery' ? (
              <>
                <Truck className="w-5 h-5" />
                Delivery Information
              </>
            ) : (
              <>
                <Store className="w-5 h-5" />
                Pickup Information
              </>
            )}
          </CardTitle>
        </CardHeader>
      )}
      
      <CardContent className="space-y-4">
        {/* Fulfillment Type */}
        <div className="flex items-center gap-2">
          <Badge variant={deliveryInfo.order_type === 'delivery' ? 'default' : 'secondary'} className="gap-1">
            {deliveryInfo.order_type === 'delivery' ? (
              <>
                <Truck className="w-3 h-3" />
                Home Delivery
              </>
            ) : (
              <>
                <Store className="w-3 h-3" />
                Store Pickup
              </>
            )}
          </Badge>
        </div>

        {/* Delivery Address & Zone */}
        {deliveryInfo.order_type === 'delivery' && (
          <>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Delivery Address</p>
                  <p className="text-sm text-muted-foreground">
                    {formatAddress(deliveryInfo.delivery_address)}
                  </p>
                  {deliveryInfo.delivery_address?.landmark && (
                    <div className="flex items-center gap-1 mt-1">
                      <Navigation className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Landmark: {deliveryInfo.delivery_address.landmark}
                      </p>
                    </div>
                  )}
                  {deliveryInfo.delivery_address?.contact_phone && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact: {deliveryInfo.delivery_address.contact_phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery Zone */}
            {deliveryInfo.delivery_zone && (
              <div className="flex items-center gap-2 bg-accent/50 p-3 rounded-lg">
                <Package className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Delivery Zone</p>
                  <p className="text-sm text-muted-foreground">{deliveryInfo.delivery_zone.name}</p>
                </div>
                {deliveryInfo.delivery_zone.delivery_fee && (
                  <Badge variant="outline">
                    ₦{deliveryInfo.delivery_zone.delivery_fee.toFixed(2)}
                  </Badge>
                )}
              </div>
            )}
          </>
        )}

        {/* Pickup Point */}
        {deliveryInfo.order_type === 'pickup' && deliveryInfo.pickup_point && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Store className="w-4 h-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Pickup Location</p>
                <p className="text-sm text-muted-foreground font-medium">
                  {deliveryInfo.pickup_point.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deliveryInfo.pickup_point.address}
                </p>
                {deliveryInfo.pickup_point.phone && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Phone: {deliveryInfo.pickup_point.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delivery Schedule */}
        {deliveryInfo.delivery_schedule && (
          <div className="bg-primary/5 p-3 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {deliveryInfo.order_type === 'delivery' ? 'Delivery Date' : 'Pickup Date'}
                  </p>
                  <p className="text-sm text-primary font-semibold">
                    {formatDate(deliveryInfo.delivery_schedule.delivery_date)}
                  </p>
                </div>
              </div>

              {/* Time Window */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Time Window</p>
                  <p className="text-sm text-primary font-semibold">
                    {formatTime(deliveryInfo.delivery_schedule.delivery_time_start)} - {formatTime(deliveryInfo.delivery_schedule.delivery_time_end)}
                  </p>
                </div>
              </div>
            </div>

            {/* Flexibility Badge */}
            {deliveryInfo.delivery_schedule.is_flexible && (
              <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                <Clock className="w-3 h-3 mr-1" />
                Flexible timing available
              </Badge>
            )}

            {/* Special Instructions */}
            {deliveryInfo.delivery_schedule.special_instructions && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Special Instructions</p>
                </div>
                <p className="text-sm text-muted-foreground bg-background/70 p-2 rounded border">
                  {deliveryInfo.delivery_schedule.special_instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Estimated Delivery (for current orders) */}
        {deliveryInfo.estimated_delivery && (
          <div className="flex items-center gap-2 bg-green-50 p-3 rounded-lg border border-green-200">
            <Clock className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Estimated Arrival</p>
              <p className="text-sm text-green-700">
                {format(new Date(deliveryInfo.estimated_delivery), 'h:mm a')}
              </p>
            </div>
          </div>
        )}

        {/* Tracking Reference */}
        {deliveryInfo.tracking_reference && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            Tracking Reference: <span className="font-mono font-medium">{deliveryInfo.tracking_reference}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};