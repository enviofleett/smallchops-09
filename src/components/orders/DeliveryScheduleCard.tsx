import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, FileText, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';
import { CountdownTimer } from './CountdownTimer';

interface DeliveryScheduleCardProps {
  schedule: DeliverySchedule;
  orderStatus?: string;
  className?: string;
}

export const DeliveryScheduleCard: React.FC<DeliveryScheduleCardProps> = ({ 
  schedule, 
  orderStatus = '',
  className = "" 
}) => {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return format(time, 'h:mm a');
  };

  const getStatusIcon = () => {
    const status = orderStatus.toLowerCase();
    if (['delivered', 'completed'].includes(status)) {
      return <Truck className="w-5 h-5 text-green-600" />;
    }
    if (['out_for_delivery', 'shipped'].includes(status)) {
      return <Truck className="w-5 h-5 text-blue-600" />;
    }
    return <Calendar className="w-5 h-5 text-primary" />;
  };

  const isDelivered = ['delivered', 'completed'].includes(orderStatus.toLowerCase());

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          {isDelivered ? 'Delivery Completed' : 'Scheduled Delivery'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Countdown Timer - only show if not delivered */}
        {!isDelivered && (
          <CountdownTimer
            deliveryDate={schedule.delivery_date}
            deliveryTimeStart={schedule.delivery_time_start}
            deliveryTimeEnd={schedule.delivery_time_end}
            isFlexible={schedule.is_flexible}
          />
        )}

        {/* Delivery Details */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delivery Date */}
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Delivery Date</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(schedule.delivery_date)}
                </p>
              </div>
            </div>

            {/* Time Window */}
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Time Window</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(schedule.delivery_time_start)} - {formatTime(schedule.delivery_time_end)}
                </p>
              </div>
            </div>
          </div>

          {/* Flexibility Badge */}
          {schedule.is_flexible && (
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                <MapPin className="w-3 h-3 mr-1" />
                Flexible delivery time
              </Badge>
            </div>
          )}

          {/* Special Instructions */}
          {schedule.special_instructions && (
            <div className="pt-2 border-t">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">
                    Special Instructions
                  </p>
                  <p className="text-sm text-muted-foreground bg-background p-3 rounded border">
                    {schedule.special_instructions}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scheduling Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Scheduled on {format(new Date(schedule.requested_at), 'MMM d, yyyy \'at\' h:mm a')}
        </div>
      </CardContent>
    </Card>
  );
};