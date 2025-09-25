import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface DeliverySchedule {
  id: string;
  order_id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  requested_at: string;
  is_flexible: boolean;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  order_type: 'pickup' | 'delivery';
  pickup_time?: string;
  special_instructions?: string;
  created_at: string;
}

interface PickupScheduleUpdateProps {
  orderId: string;
  currentSchedule?: DeliverySchedule;
  order?: Order;
  onUpdate?: () => void;
}

export const PickupScheduleUpdate: React.FC<PickupScheduleUpdateProps> = ({
  orderId,
  currentSchedule,
  order,
  onUpdate
}) => {
  const formatTimeForDisplay = (time: string) => {
    try {
      return format(new Date(`1970-01-01T${time}`), 'h:mm a');
    } catch {
      return time;
    }
  };

  // For pickup orders, use pickup_time from order if no delivery schedule exists
  const getScheduleData = () => {
    if (currentSchedule) {
      return {
        date: currentSchedule.delivery_date,
        timeStart: currentSchedule.delivery_time_start,
        timeEnd: currentSchedule.delivery_time_end,
        isFlexible: currentSchedule.is_flexible,
        specialInstructions: currentSchedule.special_instructions,
        requestedAt: currentSchedule.requested_at
      };
    }
    
    // Fallback to pickup_time for pickup orders
    if (order?.pickup_time) {
      const pickupDate = new Date(order.pickup_time);
      return {
        date: format(pickupDate, 'yyyy-MM-dd'),
        timeStart: format(pickupDate, 'HH:mm:ss'),
        timeEnd: null, // Pickup times are usually single points, not ranges
        isFlexible: false,
        specialInstructions: order.special_instructions,
        requestedAt: order.created_at
      };
    }
    
    return null;
  };

  const scheduleData = getScheduleData();
  const isPickupOrder = order?.order_type === 'pickup';

  return (
    <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-primary">
          {isPickupOrder ? 'Pickup Schedule' : 'Delivery Schedule'}
        </h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Date */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">
            {isPickupOrder ? 'Pickup Date:' : 'Date:'}
          </span>
          <div className="font-semibold">
            {scheduleData?.date ? (
              <div className="space-y-1">
                <div>
                  {format(new Date(scheduleData.date), 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') 
                    ? 'Today' 
                    : format(new Date(scheduleData.date), 'MMM d, yyyy')
                  }
                </div>
                <div className="text-xs text-muted-foreground font-normal">
                  {format(new Date(scheduleData.date), 'EEEE, MMMM do, yyyy')}
                </div>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs">
                No date scheduled
              </Badge>
            )}
          </div>
        </div>
        
        {/* Time Window */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">
            {isPickupOrder ? 'Pickup Time:' : 'Time Window:'}
          </span>
          <div className="font-semibold">
            {scheduleData?.timeStart ? (
              (() => {
                const now = new Date();
                const scheduleDate = scheduleData.date ? new Date(scheduleData.date) : new Date();
                const startTime = new Date(`${format(scheduleDate, 'yyyy-MM-dd')}T${scheduleData.timeStart}`);
                const endTime = scheduleData.timeEnd 
                  ? new Date(`${format(scheduleDate, 'yyyy-MM-dd')}T${scheduleData.timeEnd}`)
                  : startTime; // For pickup times without end time
                
                const isExpired = now > (scheduleData.timeEnd ? endTime : startTime);
                const isActive = now >= startTime && now <= endTime;
                const isUpcoming = now < startTime;
                
                return (
                  <>
                    {formatTimeForDisplay(scheduleData.timeStart)}
                    {scheduleData.timeEnd && ` – ${formatTimeForDisplay(scheduleData.timeEnd)}`}
                    {isExpired && (
                      <span className="ml-2 text-destructive">⏰ Expired</span>
                    )}
                    {isActive && (
                      <span className="ml-2 text-green-600">⏰ Active</span>
                    )}
                    {isUpcoming && (
                      <span className="ml-2 text-blue-600">⏰ Upcoming</span>
                    )}
                  </>
                );
              })()
            ) : (
              <Badge variant="outline" className="text-xs">
                No time set
              </Badge>
            )}
          </div>
        </div>
        
        {/* Day */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Day:</span>
          <div className="font-semibold">
            {scheduleData?.date ? 
              format(new Date(scheduleData.date), 'EEEE') : 
              <Badge variant="outline" className="text-xs">
                Not scheduled
              </Badge>
            }
          </div>
        </div>

        {/* Schedule Type */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Schedule Type:</span>
          <div className="font-semibold">
            {scheduleData ? (
              <Badge variant={scheduleData.isFlexible ? "secondary" : "default"} className="text-xs">
                {scheduleData.isFlexible ? 'Flexible' : (isPickupOrder ? 'Fixed Pickup' : 'Fixed Time')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Not set
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Special Instructions */}
      {scheduleData?.specialInstructions && (
        <div className="pt-3 border-t border-primary/10">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Special Instructions:</span>
            <div className="text-sm p-2 bg-background/50 rounded border text-muted-foreground">
              {scheduleData.specialInstructions}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Requested Time */}
      {scheduleData?.requestedAt && (
        <div className="pt-2 text-xs text-muted-foreground">
          Scheduled on {format(new Date(scheduleData.requestedAt), 'MMM d, yyyy \'at\' h:mm a')}
        </div>
      )}
    </div>
  );
};