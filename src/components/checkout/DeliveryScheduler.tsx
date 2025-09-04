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
import { HorizontalDatePicker } from './HorizontalDatePicker';
interface DeliverySchedulerProps {
  selectedDate?: string;
  selectedTimeSlot?: {
    start_time: string;
    end_time: string;
  };
  onScheduleChange: (date: string, timeSlot: {
    start_time: string;
    end_time: string;
  }) => void;
  className?: string;
  showHeader?: boolean;
  variant?: 'calendar' | 'horizontal';
}
export const DeliveryScheduler: React.FC<DeliverySchedulerProps> = ({
  selectedDate,
  selectedTimeSlot,
  onScheduleChange,
  className,
  showHeader = true,
  variant = 'calendar'
}) => {
  console.log('🚀 DeliveryScheduler component initializing');
  const [availableSlots, setAvailableSlots] = useState<DeliverySlot[]>([]);
  const [selectedDateSlots, setSelectedDateSlots] = useState<DeliveryTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(selectedDate ? parseISO(selectedDate) : undefined);
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

  const handleHorizontalDateSelect = (dateStr: string) => {
    const date = parseISO(dateStr);
    setCalendarDate(date);
    if (selectedTimeSlot) {
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
  const selectedSlot = availableSlots.find(slot => calendarDate && slot.date === format(calendarDate, 'yyyy-MM-dd'));
  if (loading) {
    return <DeliverySchedulingErrorBoundary>
        <Card className={className}>
          {showHeader && <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Choose Delivery Date & Time
              </CardTitle>
            </CardHeader>}
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </DeliverySchedulingErrorBoundary>;
  }
  if (variant === 'horizontal') {
    return (
      <DeliverySchedulingErrorBoundary>
        <div className={cn("space-y-6", className)}>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button variant="outline" size="sm" onClick={loadAvailableSlots} className="ml-2">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Horizontal Date Picker */}
          <HorizontalDatePicker
            selectedDate={selectedDate}
            availableSlots={availableSlots}
            onDateSelect={handleHorizontalDateSelect}
          />

          {/* Time Slots Section */}
          {calendarDate && selectedDateSlots.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Select delivery time
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {selectedDateSlots.map((timeSlot, index) => {
                  const isSelected = selectedTimeSlot?.start_time === timeSlot.start_time && 
                                   selectedTimeSlot?.end_time === timeSlot.end_time;
                  
                  return (
                    <Button
                      key={index}
                      variant={isSelected ? "default" : "outline"}
                      disabled={!timeSlot.available}
                      onClick={() => handleTimeSlotSelect(timeSlot)}
                      className={cn(
                        "h-14 px-3 flex items-center justify-center",
                        "border-2 transition-all duration-200 hover:scale-105 active:scale-95",
                        "text-center touch-manipulation rounded-lg",
                        !timeSlot.available && "opacity-50 cursor-not-allowed",
                        isSelected && "bg-primary text-primary-foreground border-primary shadow-md",
                        !isSelected && "hover:bg-muted/50 hover:border-primary/20"
                      )}
                    >
                      <span className="font-medium text-sm leading-tight">
                        {timeSlot.start_time} - {timeSlot.end_time}
                      </span>
                    </Button>
                  );
                })}
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
        </div>
      </DeliverySchedulingErrorBoundary>
    );
  }

  return <DeliverySchedulingErrorBoundary>
      <Card className={`border-primary/20 ${className}`}>
        {showHeader}
        <CardContent className="space-y-6">
        {error && <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button variant="outline" size="sm" onClick={loadAvailableSlots} className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>}

        

        {/* Calendar Section */}
        <div className="space-y-4">
          <h3 className="font-medium">Select Delivery Date</h3>
          <div className="w-full overflow-hidden rounded-lg bg-background">
            <Calendar 
              mode="single" 
              selected={calendarDate} 
              onSelect={handleDateSelect} 
              disabled={date => isDateDisabled(date) || isAfter(date, addDays(new Date(), 30))} 
              className="w-full mx-auto rounded-lg border border-border/50 pointer-events-auto shadow-sm hover:shadow-md transition-shadow duration-200" 
              classNames={{
                months: "flex flex-col space-y-4",
                month: "space-y-4 w-full",
                caption: "flex justify-center pt-3 pb-2 relative items-center",
                caption_label: "text-base md:text-lg font-semibold text-foreground",
                nav: "space-x-1 flex items-center",
                nav_button: "h-9 w-9 bg-background hover:bg-accent hover:text-accent-foreground border border-border rounded-lg transition-colors duration-200 touch-manipulation",
                nav_button_previous: "absolute left-3",
                nav_button_next: "absolute right-3",
                table: "w-full border-collapse",
                head_row: "flex mb-2",
                head_cell: "text-muted-foreground rounded-md w-full max-w-10 font-medium text-xs uppercase tracking-wide py-2 text-center",
                row: "flex w-full mt-1",
                cell: "relative p-0 text-center focus-within:relative focus-within:z-20 w-full max-w-10",
                day: cn(
                  "h-10 w-10 mx-auto font-normal transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground rounded-lg",
                  "focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  "aria-selected:opacity-100 touch-manipulation",
                  "active:scale-95 disabled:pointer-events-none"
                ),
                day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md",
                day_today: "bg-accent text-accent-foreground font-semibold ring-2 ring-primary/20",
                day_outside: "text-muted-foreground/40 opacity-50",
                day_disabled: "text-muted-foreground/30 opacity-30 cursor-not-allowed",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible"
              }} 
              modifiers={{
                holiday: date => getDateModifiers(date) === 'holiday',
                closed: date => getDateModifiers(date) === 'closed'
              }} 
              modifiersStyles={{
                holiday: {
                  backgroundColor: 'hsl(var(--destructive) / 0.1)',
                  color: 'hsl(var(--destructive))',
                  border: '1px solid hsl(var(--destructive) / 0.3)'
                },
                closed: {
                  backgroundColor: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                  textDecoration: 'line-through'
                }
              }} 
            />
          </div>

          {selectedSlot?.is_holiday && <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {selectedSlot.holiday_name} - No delivery available on this date
              </AlertDescription>
            </Alert>}
        </div>

        {/* Time Slots Section - Enhanced Mobile Layout */}
        {calendarDate && selectedDateSlots.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-base flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary" />
              Select Delivery Time for {format(calendarDate, 'EEEE, MMMM d')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {selectedDateSlots.map((timeSlot, index) => (
                <Button 
                  key={index} 
                  variant={selectedTimeSlot?.start_time === timeSlot.start_time && selectedTimeSlot?.end_time === timeSlot.end_time ? "default" : "outline"} 
                  disabled={!timeSlot.available} 
                  onClick={() => handleTimeSlotSelect(timeSlot)} 
                  className={cn(
                    "h-auto min-h-[72px] p-4 flex flex-col items-center justify-center gap-2 text-center",
                    "transition-all duration-200 touch-manipulation rounded-xl border-2",
                    "hover:scale-[1.02] active:scale-[0.98] focus:scale-[1.02]",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    !timeSlot.available && "opacity-50 cursor-not-allowed hover:scale-100",
                    timeSlot.available && "hover:shadow-md",
                    selectedTimeSlot?.start_time === timeSlot.start_time && selectedTimeSlot?.end_time === timeSlot.end_time && "ring-2 ring-primary ring-offset-2 shadow-lg"
                  )}
                >
                  <span className="font-semibold text-sm leading-tight">
                    {timeSlot.start_time} - {timeSlot.end_time}
                  </span>
                  {!timeSlot.available && timeSlot.reason && (
                    <span className="text-xs text-destructive text-center leading-tight max-w-full">
                      {timeSlot.reason}
                    </span>
                  )}
                  {timeSlot.available && (
                    <span className="text-xs text-green-600 font-medium">Available</span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* No Slots Available Alert - Enhanced */}
        {calendarDate && selectedDateSlots.length === 0 && !selectedSlot?.is_holiday && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              No delivery slots available for the selected date. Please choose a different date or contact support for assistance.
            </AlertDescription>
          </Alert>
        )}

        {/* Delivery Summary - Enhanced Mobile Design */}
        {selectedDate && selectedTimeSlot && (
          <div className="pt-6 border-t border-border/50">
            <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Delivery Schedule Summary
            </h4>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium whitespace-nowrap bg-primary/10 text-primary border-primary/20">
                  📅 {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium whitespace-nowrap bg-green-100 text-green-800 border-green-200">
                  🕒 {selectedTimeSlot.start_time} - {selectedTimeSlot.end_time}
                </Badge>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  📍 Please ensure someone is available to receive the delivery during this time window. Our delivery team will contact you 30 minutes before arrival.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      </Card>
    </DeliverySchedulingErrorBoundary>;
};