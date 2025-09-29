import React from 'react';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { MapPin, Clock, FileText } from 'lucide-react';

interface CompleteFulfillmentSectionProps {
  order: any;
  fulfillmentInfo?: any;
  deliverySchedule?: any;
  pickupPoint?: any;
}

/**
 * Complete fulfillment section handling both delivery and pickup scenarios
 * Shows full address breakdown, time windows, and special instructions
 */
export const CompleteFulfillmentSection: React.FC<CompleteFulfillmentSectionProps> = ({ 
  order, 
  fulfillmentInfo,
  deliverySchedule,
  pickupPoint 
}) => {
  const orderType = order?.order_type || 'delivery';
  const isDelivery = orderType === 'delivery';
  const isPickup = orderType === 'pickup';

  // Address handling
  const getFormattedAddress = () => {
    if (isDelivery) {
      return formatAddressMultiline(order?.delivery_address) || 'Address not available';
    } else if (isPickup && pickupPoint) {
      return pickupPoint.address || 'Pickup location to be confirmed';
    }
    return 'Address not available';
  };

  // Time window handling
  const getTimeWindow = () => {
    if (isDelivery && deliverySchedule) {
      const start = deliverySchedule.delivery_time_start;
      const end = deliverySchedule.delivery_time_end;
      const date = deliverySchedule.delivery_date;
      
      if (start && end) {
        return `${date ? new Date(date).toLocaleDateString() + ' ' : ''}${start} - ${end}`;
      }
    } else if (isPickup && order?.pickup_time) {
      return new Date(order.pickup_time).toLocaleString();
    }
    return 'Not scheduled';
  };

  // Special instructions
  const specialInstructions = deliverySchedule?.special_instructions || 
                            order?.special_instructions || 
                            'No special instructions';

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        {isDelivery ? 'Delivery Details' : 'Pickup Details'}
      </h3>
      
      <div className="space-y-4">
        {/* Address Section */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-sm text-foreground mb-2">
            {isDelivery ? 'Delivery Address' : 'Pickup Location'}
          </h4>
          <div className="text-sm text-muted-foreground whitespace-pre-line">
            {getFormattedAddress()}
          </div>
          {isPickup && pickupPoint?.name && (
            <div className="text-sm font-medium text-foreground mt-1">
              {pickupPoint.name}
            </div>
          )}
        </div>

        {/* Time Window Section */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {isDelivery ? 'Delivery Window' : 'Pickup Time'}
          </h4>
          <div className="text-sm text-muted-foreground">
            {getTimeWindow()}
          </div>
          {deliverySchedule?.is_flexible && (
            <div className="text-xs text-amber-600 mt-1">
              Flexible timing available
            </div>
          )}
        </div>

        {/* Special Instructions Section */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Special Instructions
          </h4>
          <div className="text-sm text-muted-foreground">
            {specialInstructions}
          </div>
        </div>

        {/* Pickup Point Operating Hours */}
        {isPickup && pickupPoint?.operating_hours && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm text-foreground mb-2">Operating Hours</h4>
            <div className="text-sm text-muted-foreground">
              {JSON.stringify(pickupPoint.operating_hours, null, 2)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};