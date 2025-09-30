import React from 'react';
import { MapPin, Clock, FileText, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Order } from '@/types/orderDetailsModal';
import { getOrderTimeWindow, hasValidTimeField, formatDeliveryDate } from '@/utils/timeWindowUtils';

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

  // Use the new 1-hour window logic
  const timeWindow = getOrderTimeWindow(order);
  const hasValidTime = hasValidTimeField(order);
  const deliveryDateFormatted = order.delivery_date ? formatDeliveryDate(order.delivery_date) : null;

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
        {/* Critical Error: Missing Time Field */}
        {!hasValidTime && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Data Error:</strong> Missing {isDelivery ? 'delivery' : 'pickup'} time for this order.
              Please contact support to resolve this issue.
            </AlertDescription>
          </Alert>
        )}

        {/* Delivery Date */}
        {deliveryDateFormatted && (
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-1" />
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {deliveryDateFormatted}
              </p>
              <p className="text-xs text-muted-foreground">
                {isDelivery ? 'Delivery Date' : 'Pickup Date'}
              </p>
            </div>
          </div>
        )}

        {/* Address */}
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

        {/* Time Window (1-hour window) */}
        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 text-muted-foreground mt-1" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {timeWindow || 'Time not available'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isDelivery ? 'Delivery Window' : 'Pickup Time'} (1-hour window)
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