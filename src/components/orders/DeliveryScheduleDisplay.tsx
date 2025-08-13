import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';

interface DeliveryScheduleDisplayProps {
  schedule: DeliverySchedule;
  className?: string;
}

export const DeliveryScheduleDisplay: React.FC<DeliveryScheduleDisplayProps> = ({ 
  schedule, 
  className = "" 
}) => {
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return format(time, 'h:mm a');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMM d, yyyy');
  };

  return (
    <Card className={`border-blue-200 bg-blue-50/50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5" />
          Delivery Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Delivery Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">Delivery Date</p>
              <p className="text-sm text-blue-800 font-semibold">
                {formatDate(schedule.delivery_date)}
              </p>
            </div>
          </div>

          {/* Time Window */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">Time Window</p>
              <p className="text-sm text-blue-800 font-semibold">
                {formatTime(schedule.delivery_time_start)} - {formatTime(schedule.delivery_time_end)}
              </p>
            </div>
          </div>
        </div>

        {/* Flexibility Badge */}
        {schedule.is_flexible && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
              <MapPin className="w-3 h-3 mr-1" />
              Flexible delivery time
            </Badge>
          </div>
        )}

        {/* Special Instructions */}
        {schedule.special_instructions && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-gray-700">Special Instructions</p>
            </div>
            <p className="text-sm text-gray-600 bg-white/70 p-2 rounded border">
              {schedule.special_instructions}
            </p>
          </div>
        )}

        {/* Requested Date */}
        <div className="text-xs text-gray-500 border-t pt-2 mt-3">
          Scheduled on {format(new Date(schedule.requested_at), 'MMM d, yyyy \'at\' h:mm a')}
        </div>
      </CardContent>
    </Card>
  );
};