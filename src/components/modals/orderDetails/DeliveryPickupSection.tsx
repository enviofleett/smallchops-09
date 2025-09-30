import React from 'react';
import { MapPin, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Order } from '@/types/orderDetailsModal';

interface DeliveryPickupSectionProps {
  order: Order;
}

export const DeliveryPickupSection: React.FC<DeliveryPickupSectionProps> = ({ order }) => {
  const isDelivery = order.order_type === 'delivery';
  const sectionTitle = isDelivery ? 'Delivery Information' : 'Pickup Information';
  const LocationIcon = MapPin;

  const formatAddress = (address: any) => {
    if (typeof address === 'string') {
      return address;
    }
    
    if (address && typeof address === 'object') {
      const parts = [
        address.address_line_1,
        address.address_line_2,
        address.city,
        address.state,
        address.postal_code,
      ].filter(Boolean);
      
      return parts.join(', ') || 'Address not available';
    }
    
    return 'Address not available';
  };

  const formatTimeWindow = () => {
    if (isDelivery) {
      // For delivery orders, check various delivery time fields
      if (typeof order.delivery_address === 'object' && order.delivery_address && 'delivery_window' in order.delivery_address) {
        return (order.delivery_address as any).delivery_window;
      }
      // Add other delivery time logic here
      return 'Time window not specified';
    } else {
      // For pickup orders
      if (order.pickup_time) {
        return new Date(order.pickup_time).toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return 'Pickup time not specified';
    }
  };

  const getAddress = () => {
    if (isDelivery) {
      return formatAddress(order.delivery_address);
    } else {
      // For pickup, you might have a pickup address or location
      return 'Pickup location - See business details';
    }
  };

  return (
    <Card className="keep-together">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <LocationIcon className="h-5 w-5 text-primary" />
          {sectionTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {getAddress()}
            </p>
            <p className="text-xs text-muted-foreground">
              {isDelivery ? 'Delivery Address' : 'Pickup Location'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 text-muted-foreground mt-1" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {formatTimeWindow()}
            </p>
            <p className="text-xs text-muted-foreground">
              {isDelivery ? 'Delivery Window' : 'Pickup Time'}
            </p>
          </div>
        </div>

        {order.special_instructions && (
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-muted-foreground mt-1" />
            <div className="flex-1">
              <p className="text-foreground">
                {order.special_instructions}
              </p>
              <p className="text-xs text-muted-foreground">
                Special Instructions
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};