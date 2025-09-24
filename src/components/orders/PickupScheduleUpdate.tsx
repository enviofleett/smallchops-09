import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface PickupScheduleUpdateProps {
  orderId: string;
  currentSchedule?: any;
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

  const getBusinessDay = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE');
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-primary">Pickup Schedule Fulfillment</h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Channel */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Channel:</span>
          <div className="font-semibold text-primary">Pickup</div>
        </div>
        
        {/* Pickup Date */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Pickup Date:</span>
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
                No schedule set
              </Badge>
            )}
          </div>
        </div>
        
        {/* Pickup Time Window */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Pickup Time Window:</span>
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
                      <span className="ml-2 text-destructive">⏰ Expired window</span>
                    )}
                    {isActive && (
                      <span className="ml-2 text-green-600">⏰ Active window</span>
                    )}
                    {isUpcoming && (
                      <span className="ml-2">⏰ Upcoming window</span>
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
          <span className="text-xs text-muted-foreground font-medium">Business Day:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_date ? 
              format(new Date(currentSchedule.delivery_date), 'EEEE') : 
              <Badge variant="outline" className="text-xs">
                Not scheduled
              </Badge>
            }
          </div>
        </div>
      </div>
    </div>
  );
};