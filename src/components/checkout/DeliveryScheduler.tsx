import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, AlertTriangle } from 'lucide-react';
import { deliverySchedulingService, DeliverySlot, DeliveryTimeSlot } from '@/utils/deliveryScheduling';
import { isAfter, addDays } from 'date-fns';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySchedulingErrorBoundary } from './DeliverySchedulingErrorBoundary';

interface DeliverySchedulerProps {
  selectedDate?: string;
  selectedTimeSlot?: { start_time: string; end_time: string };
  onScheduleChange: (date: string, timeSlot: { start_time: string; end_time: string }) => void;
  className?: string;
}

export const DeliveryScheduler: React.FC<DeliverySchedulerProps> = ({
  selectedDate,
  selectedTimeSlot,
  onScheduleChange,
  className
}) => {
  const [availableSlots, setAvailableSlots] = useState<DeliverySlot[]>([]);
  const [selectedDateSlots, setSelectedDateSlots] = useState<DeliveryTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(
    selectedDate ? parseISO(selectedDate) : undefined
  );

  useEffect(() => {
    loadAvailableSlots();
  }, []);

  useEffect(() => {
    if (calendarDate) {
      const dateStr = format(calendarDate, 'yyyy-MM-dd');
      const daySlots = availableSlots.find(slot => slot.date === dateStr);
      setSelectedDateSlots(daySlots?.time_slots || []);
    } else {
      setSelectedDateSlots([]);
    }
  }, [calendarDate, availableSlots]);

  const loadAvailableSlots = async () => {
    try {
      setLoading(true);
      setError(null);
      const slots = await deliverySchedulingService.getAvailableDeliverySlots();
      setAvailableSlots(slots);
      
      if (slots.length === 0) {
        setError('No delivery slots available. Please contact support.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load available delivery slots';
      setError(errorMessage);
      console.error('Error loading delivery slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slot = availableSlots.find(s => s.date === dateStr);
    return !slot?.is_business_day || slot.is_holiday;
  };

  const getDateModifiers = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slot = availableSlots.find(s => s.date === dateStr);
    
    if (slot?.is_holiday) return 'holiday';
    if (!slot?.is_business_day) return 'closed';
    return undefined;
  };

  const handleDateSelect = (date: Date | undefined) => {
    setCalendarDate(date);
    if (date && selectedTimeSlot) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onScheduleChange(dateStr, selectedTimeSlot);
    }
  };

  const handleTimeSlotSelect = (timeSlot: DeliveryTimeSlot) => {
    if (!timeSlot.available || !calendarDate) return;

    const dateStr = format(calendarDate, 'yyyy-MM-dd');
    const newTimeSlot = {
      start_time: timeSlot.start_time,
      end_time: timeSlot.end_time
    };
    
    onScheduleChange(dateStr, newTimeSlot);
  };

  const selectedSlot = availableSlots.find(slot => 
    calendarDate && slot.date === format(calendarDate, 'yyyy-MM-dd')
  );

  if (loading) {
    return (
      <DeliverySchedulingErrorBoundary>
        <Card className={className}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Choose Delivery Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </DeliverySchedulingErrorBoundary>
    );
  }

  return (
    <DeliverySchedulingErrorBoundary>
      <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Choose Delivery Date & Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadAvailableSlots}
                className="ml-2"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Delivery must be scheduled at least 90 minutes in advance. Store hours apply.
          </AlertDescription>
        </Alert>

        {/* Calendar Section */}
        <div className="space-y-4">
          <h3 className="font-medium">Select Delivery Date</h3>
          <Calendar
            mode="single"
            selected={calendarDate}
            onSelect={handleDateSelect}
            disabled={(date) => isDateDisabled(date) || isAfter(date, addDays(new Date(), 30))}
            className="rounded-md border pointer-events-auto"
            modifiers={{
              holiday: (date) => getDateModifiers(date) === 'holiday',
              closed: (date) => getDateModifiers(date) === 'closed'
            }}
            modifiersStyles={{
              holiday: { 
                backgroundColor: 'hsl(var(--destructive))', 
                color: 'hsl(var(--destructive-foreground))' 
              },
              closed: { 
                backgroundColor: 'hsl(var(--muted))', 
                color: 'hsl(var(--muted-foreground))' 
              }
            }}
          />

          {selectedSlot?.is_holiday && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {selectedSlot.holiday_name} - No delivery available on this date
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Time Slots Section */}
        {calendarDate && selectedDateSlots.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Select Delivery Time</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedDateSlots.map((timeSlot, index) => (
                <Button
                  key={index}
                  variant={
                    selectedTimeSlot?.start_time === timeSlot.start_time &&
                    selectedTimeSlot?.end_time === timeSlot.end_time
                      ? "default"
                      : "outline"
                  }
                  disabled={!timeSlot.available}
                  onClick={() => handleTimeSlotSelect(timeSlot)}
                  className={cn(
                    "h-auto p-3 flex flex-col items-center gap-1",
                    !timeSlot.available && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="font-medium">
                    {timeSlot.start_time} - {timeSlot.end_time}
                  </span>
                  {!timeSlot.available && timeSlot.reason && (
                    <span className="text-xs text-muted-foreground text-center">
                      {timeSlot.reason}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {calendarDate && selectedDateSlots.length === 0 && !selectedSlot?.is_holiday && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No delivery slots available for the selected date.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary */}
        {selectedDate && selectedTimeSlot && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Delivery Schedule Summary</h4>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Badge variant="secondary" className="whitespace-nowrap">
                {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
              </Badge>
              <Badge variant="secondary" className="whitespace-nowrap">
                {selectedTimeSlot.start_time} - {selectedTimeSlot.end_time}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Please ensure someone is available to receive the delivery during this time window.
            </p>
          </div>
        )}
      </CardContent>
      </Card>
    </DeliverySchedulingErrorBoundary>
  );
};