import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, AlertTriangle } from 'lucide-react';
import { deliverySchedulingService, DeliverySlot, DeliveryTimeSlot } from '@/utils/deliveryScheduling';
import { isAfter, addDays } from 'date-fns';
import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySchedulingErrorBoundary } from './DeliverySchedulingErrorBoundary';

interface DeliverySchedulerProps {
  selectedDate?: string;
  selectedTimeSlot?: { start_time: string; end_time: string };
  onScheduleChange: (date: string, timeSlot: { start_time: string; end_time: string }) => void;
  className?: string;
  showHeader?: boolean;
}

export const DeliveryScheduler: React.FC<DeliverySchedulerProps> = ({
  selectedDate,
  selectedTimeSlot,
  onScheduleChange,
  className,
  showHeader = true
}) => {
  console.log('🚀 DeliveryScheduler component initializing');
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

  const loadAvailableSlots = useCallback(async () => {
    try {
      console.log('📋 Loading delivery slots...');
      setLoading(true);
      setError(null);
      
      const endDate = addDays(new Date(), 30);
      console.log('🕐 Getting slots from service...');
      const slots = await deliverySchedulingService.getAvailableDeliverySlots(new Date(), endDate);
      console.log('✅ Delivery slots loaded:', slots.length);
      
      setAvailableSlots(slots);
      
      if (slots.length === 0) {
        setError('No delivery slots available. Please contact support.');
      }
    } catch (err) {
      console.error('❌ Failed to load delivery slots:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load available delivery slots';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

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
          {showHeader && (
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Choose Delivery Date & Time
              </CardTitle>
            </CardHeader>
          )}
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
      <Card className={`border-primary/20 ${className}`}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Schedule Your Delivery
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose your preferred delivery date and time
            </p>
          </CardHeader>
        )}
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
          <div className="w-full overflow-hidden">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={handleDateSelect}
              disabled={(date) => isDateDisabled(date) || isAfter(date, addDays(new Date(), 30))}
              className="w-full mx-auto rounded-md border pointer-events-auto scale-90 sm:scale-100 origin-top"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center text-sm sm:text-base",
                caption_label: "text-sm sm:text-base font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 hover:bg-accent hover:text-accent-foreground border rounded-md",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-8 sm:w-9 font-normal text-xs sm:text-sm",
                row: "flex w-full mt-2",
                cell: "text-center text-xs sm:text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors text-xs sm:text-sm touch-manipulation",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible"
              }}
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
          </div>

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
            <h3 className="font-medium text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Select Delivery Time for {format(calendarDate, 'EEEE, MMMM d')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
                    "h-auto min-h-[64px] p-3 sm:p-4 flex flex-col items-center justify-center gap-1 text-center touch-manipulation",
                    "hover:scale-105 transition-all duration-200 active:scale-95",
                    !timeSlot.available && "opacity-50 cursor-not-allowed",
                    "sm:min-h-[72px] rounded-lg border-2"
                  )}
                >
                  <span className="font-medium text-sm sm:text-base">
                    {timeSlot.start_time} - {timeSlot.end_time}
                  </span>
                  {!timeSlot.available && timeSlot.reason && (
                    <span className="text-xs text-red-500 text-center leading-tight">
                      {timeSlot.reason}
                    </span>
                  )}
                  {timeSlot.available && (
                    <span className="text-xs text-green-600">Available</span>
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