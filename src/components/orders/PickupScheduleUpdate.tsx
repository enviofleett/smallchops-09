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

interface PickupScheduleUpdateProps {
  orderId: string;
  currentSchedule?: DeliverySchedule;
  onUpdate?: () => void;
}

export const PickupScheduleUpdate: React.FC<PickupScheduleUpdateProps> = ({
  orderId,
  currentSchedule,
  onUpdate
}) => {
  const formatTimeForDisplay = (time: string) => {
    try {
      return format(new Date(`1970-01-01T${time}`), 'h:mm a');
    } catch {
      return time;
    }
  };

  return (
    <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-primary">
          {currentSchedule ? 'Delivery Schedule Fulfillment' : 'Schedule Fulfillment'}
        </h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Pickup Date */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Date:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_date ? (
              <div className="space-y-1">
                <div>
                  {format(new Date(currentSchedule.delivery_date), 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') 
                    ? 'Today' 
                    : format(new Date(currentSchedule.delivery_date), 'MMM d, yyyy')
                  }
                </div>
                <div className="text-xs text-muted-foreground font-normal">
                  {format(new Date(currentSchedule.delivery_date), 'EEEE, MMMM do, yyyy')}
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
          <span className="text-xs text-muted-foreground font-medium">Time Window:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_time_start && currentSchedule?.delivery_time_end ? (
              (() => {
                const now = new Date();
                const scheduleDate = currentSchedule.delivery_date ? new Date(currentSchedule.delivery_date) : new Date();
                const startTime = new Date(`${format(scheduleDate, 'yyyy-MM-dd')}T${currentSchedule.delivery_time_start}`);
                const endTime = new Date(`${format(scheduleDate, 'yyyy-MM-dd')}T${currentSchedule.delivery_time_end}`);
                
                const isExpired = now > endTime;
                const isActive = now >= startTime && now <= endTime;
                const isUpcoming = now < startTime;
                
                return (
                  <>
                    {formatTimeForDisplay(currentSchedule.delivery_time_start)} – {formatTimeForDisplay(currentSchedule.delivery_time_end)}
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
                No time window set
              </Badge>
            )}
          </div>
        </div>
        
        {/* Business Day */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Day:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_date ? 
              format(new Date(currentSchedule.delivery_date), 'EEEE') : 
              <Badge variant="outline" className="text-xs">
                Not scheduled
              </Badge>
            }
          </div>
        </div>

        {/* Flexibility Status */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Schedule Type:</span>
          <div className="font-semibold">
            {currentSchedule ? (
              <Badge variant={currentSchedule.is_flexible ? "secondary" : "default"} className="text-xs">
                {currentSchedule.is_flexible ? 'Flexible' : 'Fixed Time'}
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
      {currentSchedule?.special_instructions && (
        <div className="pt-3 border-t border-primary/10">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Special Instructions:</span>
            <div className="text-sm p-2 bg-background/50 rounded border text-muted-foreground">
              {currentSchedule.special_instructions}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Requested Time */}
      {currentSchedule?.requested_at && (
        <div className="pt-2 text-xs text-muted-foreground">
          Scheduled on {format(new Date(currentSchedule.requested_at), 'MMM d, yyyy \'at\' h:mm a')}
        </div>
      )}
    </div>
  );
};