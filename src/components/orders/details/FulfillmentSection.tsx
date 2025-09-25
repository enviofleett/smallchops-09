import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface FulfillmentSectionProps {
  order: {
    order_type: 'pickup' | 'delivery';
    status: string;
    delivery_address?: string | null;
  };
  deliverySchedule?: {
    scheduled_date?: string;
    delivery_date?: string;
    scheduled_time?: string;
    delivery_time_start?: string;
    delivery_time_end?: string;
    is_flexible?: boolean;
    special_instructions?: string;
    requested_at?: string;
  } | null;
  pickupPoint?: {
    address?: string;
    name?: string;
  } | null;
  fulfillmentInfo?: {
    type: 'pickup' | 'delivery';
    booking_window?: string;
    delivery_hours?: {
      start: string;
      end: string;
      is_flexible: boolean;
    };
    address?: string;
    special_instructions?: string;
    requested_at?: string;
    business_hours?: any;
  };
}

export const FulfillmentSection: React.FC<FulfillmentSectionProps> = ({
  order,
  deliverySchedule,
  pickupPoint,
  fulfillmentInfo
}) => {
  const getDeliveryInfo = () => {
    // Use fulfillment info if available (comprehensive data)
    if (fulfillmentInfo) {
      const bookingDate = fulfillmentInfo.booking_window;
      const formattedTime = bookingDate ? 
        format(new Date(bookingDate), 'PPP p') : 
        'Not scheduled';
        
      return {
        type: fulfillmentInfo.type === 'pickup' ? 'Pickup' : 'Delivery',
        address: fulfillmentInfo.address || 'Address not available',
        time: formattedTime
      };
    }
    
    // Fallback to original logic
    if (order.order_type === 'pickup' && pickupPoint) {
      return {
        type: 'Pickup',
        address: pickupPoint.address || pickupPoint.name || 'Pickup Point',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    } else if (order.order_type === 'delivery') {
      return {
        type: 'Delivery',
        address: order.delivery_address || 'Not provided',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    }
    return { type: 'Unknown', address: 'Not provided', time: 'Not scheduled' };
  };

  const deliveryInfo = getDeliveryInfo();

  const formatTimeWindow = () => {
    // Use fulfillment info delivery hours if available
    if (fulfillmentInfo?.delivery_hours) {
      try {
        const formatTime = (timeString: string) => {
          const [hours, minutes] = timeString.split(':');
          const time = new Date();
          time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          return format(time, 'p');
        };
        
        const startTime = formatTime(fulfillmentInfo.delivery_hours.start);
        const endTime = formatTime(fulfillmentInfo.delivery_hours.end);
        const flexibleIndicator = fulfillmentInfo.delivery_hours.is_flexible ? ' (Flexible)' : '';
        return `${startTime} – ${endTime}${flexibleIndicator} ⏰ Upcoming window`;
      } catch {
        return '4:00 PM – 5:00 PM ⏰ Upcoming window';
      }
    }
    
    const scheduleDate = deliverySchedule?.scheduled_date || deliverySchedule?.delivery_date;
    
    if (scheduleDate) {
      try {
        const date = new Date(scheduleDate);
        const startTime = format(date, 'p');
        const endTime = format(new Date(date.getTime() + 60*60*1000), 'p'); // Add 1 hour
        return `${startTime} – ${endTime} ⏰ Upcoming window`;
      } catch {
        return '4:00 PM – 5:00 PM ⏰ Upcoming window';
      }
    }
    
    // Use delivery time window if available
    if (deliverySchedule?.delivery_time_start && deliverySchedule?.delivery_time_end) {
      try {
        const formatTime = (timeString: string) => {
          const [hours, minutes] = timeString.split(':');
          const time = new Date();
          time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          return format(time, 'p');
        };
        
        const startTime = formatTime(deliverySchedule.delivery_time_start);
        const endTime = formatTime(deliverySchedule.delivery_time_end);
        const flexibleIndicator = deliverySchedule.is_flexible ? ' (Flexible)' : '';
        return `${startTime} – ${endTime}${flexibleIndicator} ⏰ Upcoming window`;
      } catch {
        return '4:00 PM – 5:00 PM ⏰ Upcoming window';
      }
    }
    
    return '4:00 PM – 5:00 PM ⏰ Upcoming window';
  };

  const getBusinessDay = () => {
    // Use fulfillment info booking window if available
    if (fulfillmentInfo?.booking_window) {
      try {
        return format(new Date(fulfillmentInfo.booking_window), 'EEEE');
      } catch {
        return format(new Date(), 'EEEE');
      }
    }
    
    const scheduleDate = deliverySchedule?.scheduled_date || deliverySchedule?.delivery_date;
    
    if (scheduleDate) {
      try {
        return format(new Date(scheduleDate), 'EEEE');
      } catch {
        return format(new Date(), 'EEEE');
      }
    }
    return format(new Date(), 'EEEE');
  };

  const getPickupDate = () => {
    // Use fulfillment info booking window if available
    if (fulfillmentInfo?.booking_window) {
      try {
        return format(new Date(fulfillmentInfo.booking_window), 'PPP');
      } catch {
        return 'Today';
      }
    }
    
    const scheduleDate = deliverySchedule?.scheduled_date || deliverySchedule?.delivery_date;
    
    if (scheduleDate) {
      try {
        return format(new Date(scheduleDate), 'PPP');
      } catch {
        return 'Today';
      }
    }
    return 'Today';
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-purple-800 flex items-center gap-2 text-lg">
          {order.order_type === 'pickup' ? (
            <Package className="w-5 h-5" />
          ) : (
            <Truck className="w-5 h-5" />
          )}
          {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Schedule Fulfillment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Channel */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
              {order.order_type === 'pickup' ? (
                <Package className="w-4 h-4 text-purple-600" />
              ) : (
                <Truck className="w-4 h-4 text-purple-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Channel</p>
              <p className="text-sm text-purple-800 font-semibold">
                {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'}
              </p>
            </div>
          </div>

          {/* Order Status */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
              <Badge variant="outline" className="w-4 h-4 p-0 border-0 bg-transparent">
                📋
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Order Status</p>
              <Badge variant="secondary" className="text-xs">
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Date
              </p>
              <p className="text-sm text-purple-800 font-semibold">
                {getPickupDate()}
              </p>
            </div>
          </div>

          {/* Time Window */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Time Window
              </p>
              <p className="text-sm text-purple-800 font-semibold">
                {formatTimeWindow()}
              </p>
            </div>
          </div>

          {/* Business Day */}
          <div className="flex items-start gap-3 sm:col-span-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Business Day</p>
              <p className="text-sm text-purple-800 font-semibold">
                {getBusinessDay()}
              </p>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="border-t pt-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
              <MapPin className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">
                {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Address
              </p>
              <p className="text-sm text-gray-600 bg-white/70 p-2 rounded border mt-1">
                {deliveryInfo.address}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};