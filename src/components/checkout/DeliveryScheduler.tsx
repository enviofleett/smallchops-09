import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, AlertTriangle, Info } from 'lucide-react';
import { deliverySchedulingService, DeliverySlot, DeliveryTimeSlot } from '@/utils/deliveryScheduling';
import { isAfter, addDays, addMonths, isBefore, startOfDay, endOfDay, differenceInDays, isWeekend } from 'date-fns';
import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySchedulingErrorBoundary } from './DeliverySchedulingErrorBoundary';
import { HorizontalDatePicker } from './HorizontalDatePicker';
import { ProgressiveLoader } from '@/components/ui/progressive-loader';
import { LoadingProgress } from '@/components/ui/loading-progress';
import { deliveryBookingAPI } from '@/api/deliveryBookingApi';

// Production-ready constants
const DELIVERY_BOOKING_CONSTANTS = {
  MIN_ADVANCE_DAYS: 1, // Minimum 1 day advance booking
  MAX_ADVANCE_MONTHS: 6, // 6 months advance booking
  BUSINESS_DAYS_ONLY: false, // Set to true if delivery only on business days
  BLOCKED_DATES: [] as Date[], // Specific dates to block (holidays, maintenance days)
} as const;
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
  const [hasInitialLoad, setHasInitialLoad] = useState(false); // Track if initial load is complete
  const [loadingProgress, setLoadingProgress] = useState(0); // Track loading progress
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(selectedDate ? parseISO(selectedDate) : undefined);

  // Production-ready date validation functions
  const dateValidation = useMemo(() => {
    const now = new Date();
    const minDate = addDays(startOfDay(now), DELIVERY_BOOKING_CONSTANTS.MIN_ADVANCE_DAYS);
    const maxDate = addMonths(startOfDay(now), DELIVERY_BOOKING_CONSTANTS.MAX_ADVANCE_MONTHS);

    return {
      minDate,
      maxDate,
      isDateInRange: (date: Date) => {
        const dayStart = startOfDay(date);
        return !isBefore(dayStart, minDate) && !isAfter(dayStart, maxDate);
      },
      isDateBlocked: (date: Date) => {
        const dayStart = startOfDay(date);
        return DELIVERY_BOOKING_CONSTANTS.BLOCKED_DATES.some(blockedDate => 
          startOfDay(blockedDate).getTime() === dayStart.getTime()
        );
      },
      isBusinessDayOnly: (date: Date) => {
        return DELIVERY_BOOKING_CONSTANTS.BUSINESS_DAYS_ONLY ? !isWeekend(date) : true;
      },
      getDateDisabledReason: (date: Date) => {
        const dayStart = startOfDay(date);
        
        if (isBefore(dayStart, minDate)) {
          return `Minimum ${DELIVERY_BOOKING_CONSTANTS.MIN_ADVANCE_DAYS} day advance booking required`;
        }
        
        if (isAfter(dayStart, maxDate)) {
          return `Booking available up to ${DELIVERY_BOOKING_CONSTANTS.MAX_ADVANCE_MONTHS} months in advance`;
        }
        
        if (DELIVERY_BOOKING_CONSTANTS.BUSINESS_DAYS_ONLY && isWeekend(date)) {
          return 'Delivery not available on weekends';
        }
        
        if (DELIVERY_BOOKING_CONSTANTS.BLOCKED_DATES.some(blockedDate => 
          startOfDay(blockedDate).getTime() === dayStart.getTime()
        )) {
          return 'Delivery not available on this date';
        }
        
        return null;
      }
    };
  }, []);

  // Enhanced date disabled function with comprehensive validation
  const isDateDisabled = useCallback((date: Date) => {
    // Check if date is in valid range
    if (!dateValidation.isDateInRange(date)) {
      return true;
    }

    // Check if date is blocked
    if (dateValidation.isDateBlocked(date)) {
      return true;
    }

    // Check business days requirement
    if (!dateValidation.isBusinessDayOnly(date)) {
      return true;
    }

    // Check if it's a past date (extra safety)
    if (isBefore(startOfDay(date), startOfDay(new Date()))) {
      return true;
    }

   return false;
  }, [dateValidation]);
  
  const loadAvailableSlots = useCallback(async () => {
    try {
      console.log('📋 Loading delivery slots with production API...');
      setLoading(true);
      setError(null);
      setLoadingProgress(10); // Start progress
      
      // Use optimized date range
      const startDate = dateValidation.minDate;
      const endDate = dateValidation.maxDate;
      
      console.log('🕐 Fetching 6-month delivery availability:', {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      });
      
      setLoadingProgress(30); // API call starting
      
      const response = await deliveryBookingAPI.getAvailableSlots({
        start_date: deliveryBookingAPI.formatDateForAPI(startDate),
        end_date: deliveryBookingAPI.formatDateForAPI(endDate)
      });
      
      setLoadingProgress(70); // Data received
      
      console.log('✅ Slots loaded:', response.slots.length, 'business days:', response.business_days);
      
      // Convert API format for compatibility
      const convertedSlots: DeliverySlot[] = response.slots.map(slot => ({
        date: slot.date,
        is_business_day: slot.is_business_day,
        is_holiday: slot.is_holiday,
        holiday_name: slot.holiday_name,
        time_slots: slot.time_slots.map(timeSlot => ({
          start_time: timeSlot.start_time,
          end_time: timeSlot.end_time,
          available: timeSlot.available,
          reason: timeSlot.reason
        }))
      }));
      
      setLoadingProgress(90); // Processing complete
      
      setAvailableSlots(convertedSlots);
      setHasInitialLoad(true);
      
      if (convertedSlots.length === 0) {
        setError('No delivery slots available for the next 6 months. Please contact support.');
      }
      
      setLoadingProgress(100); // Complete
    } catch (err) {
      console.error('❌ Failed to load delivery slots:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load available delivery slots';
      
      // Only show error if we've completed initial load attempt
      if (hasInitialLoad) {
        setError(errorMessage);
      } else {
        // For initial load, show user-friendly message
        setError('Having trouble connecting to delivery services. Please check your connection and try again.');
      }
      setLoadingProgress(0);
    } finally {
      setLoading(false);
      // Complete progress after a short delay
      setTimeout(() => setLoadingProgress(0), 500);
    }
  }, [dateValidation, hasInitialLoad]);

  useEffect(() => {
    // Only load slots on mount, prevent error flash on initial render
    const timer = setTimeout(() => {
      loadAvailableSlots();
    }, 100); // Small delay to prevent error flash
    
    return () => clearTimeout(timer);
  }, [loadAvailableSlots]);

  useEffect(() => {
    if (calendarDate) {
      const dateStr = format(calendarDate, 'yyyy-MM-dd');
      const daySlots = availableSlots.find(slot => slot.date === dateStr);
      setSelectedDateSlots(daySlots?.time_slots || []);
    } else {
      setSelectedDateSlots([]);
    }
  }, [calendarDate, availableSlots]);

  // Legacy date modifier functions for existing slot data
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
  
  // Render content wrapped in ProgressiveLoader for optimized loading experience
  const renderContent = () => {
    if (variant === 'horizontal') {
      return (
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
      );
    }

    return (
      <Card className={`border-primary/20 ${className}`}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Choose Delivery Date & Time
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-6">
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

          {/* Calendar Section with Enhanced Date Range Info */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="font-medium text-foreground">Select Delivery Date</h3>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Book up to {DELIVERY_BOOKING_CONSTANTS.MAX_ADVANCE_MONTHS} months ahead
                </span>
              </div>
            </div>
            
            {/* Date Range Information */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                📅 <strong>Booking Range:</strong> {format(dateValidation.minDate, 'MMM d')} - {format(dateValidation.maxDate, 'MMM d, yyyy')}
                {DELIVERY_BOOKING_CONSTANTS.BUSINESS_DAYS_ONLY && (
                  <span className="block mt-1">
                    🏢 <strong>Business days only</strong> (Monday-Friday)
                  </span>
                )}
              </p>
            </div>

            <div className="w-full overflow-hidden rounded-lg bg-background">
              <Calendar 
                mode="single" 
                selected={calendarDate} 
                onSelect={handleDateSelect} 
                disabled={isDateDisabled}
                fromDate={dateValidation.minDate}
                toDate={dateValidation.maxDate}
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
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md ring-2 ring-primary ring-offset-1",
                  day_today: "bg-accent text-accent-foreground font-semibold ring-2 ring-primary/20",
                  day_outside: "text-muted-foreground/40 opacity-30",
                  day_disabled: "text-muted-foreground/20 opacity-20 cursor-not-allowed line-through",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible"
                }} 
                modifiers={{
                  holiday: date => getDateModifiers(date) === 'holiday',
                  closed: date => getDateModifiers(date) === 'closed',
                  weekend: date => isWeekend(date),
                  farFuture: date => differenceInDays(date, new Date()) > 90
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
                  },
                  weekend: DELIVERY_BOOKING_CONSTANTS.BUSINESS_DAYS_ONLY ? {
                    backgroundColor: 'hsl(var(--muted) / 0.5)',
                    color: 'hsl(var(--muted-foreground))'
                  } : {},
                  farFuture: {
                    backgroundColor: 'hsl(var(--blue-50))',
                    color: 'hsl(var(--blue-700))',
                    fontSize: '0.8rem'
                  }
                }} 
              />
            </div>

            {/* Date Selection Feedback */}
            {calendarDate && (
              <div className="text-sm text-muted-foreground bg-green-50 border border-green-200 rounded-lg p-3">
                ✅ Selected: <strong>{format(calendarDate, 'EEEE, MMMM d, yyyy')}</strong>
                {selectedSlot?.is_holiday && (
                  <span className="block mt-1 text-amber-700">
                    🎉 <strong>Holiday:</strong> {selectedSlot.holiday_name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Time Slots Section */}
          {calendarDate && selectedDateSlots.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Available delivery times for {format(calendarDate, 'MMMM d')}
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
                      title={!timeSlot.available ? timeSlot.reason : undefined}
                    >
                      <span className="font-medium text-sm leading-tight">
                        {timeSlot.start_time} - {timeSlot.end_time}
                      </span>
                    </Button>
                  );
                })}
              </div>
              
              {/* Unavailable time slots feedback */}
              {selectedDateSlots.some(slot => !slot.available) && (
                <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ℹ️ Some time slots may be unavailable due to capacity limits or existing bookings.
                </div>
              )}
            </div>
          )}

          {/* No slots available message */}
          {calendarDate && selectedDateSlots.length === 0 && !selectedSlot?.is_holiday && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No delivery time slots are available for {format(calendarDate, 'MMMM d, yyyy')}. 
                Please select a different date.
              </AlertDescription>
            </Alert>
          )}

          {/* Holiday message */}
          {selectedSlot?.is_holiday && (
            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                🎉 <strong>{selectedSlot.holiday_name}</strong> - Delivery may be limited on this holiday.
                {selectedDateSlots.length === 0 && ' Please choose another date.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  // Use ProgressiveLoader with custom loading indicator
  return (
    <DeliverySchedulingErrorBoundary>
      <ProgressiveLoader
        isLoading={loading}
        error={error && hasInitialLoad ? new Error(error) : null} // Only show errors after initial load
        data={availableSlots}
        skeletonType="card"
        retryFn={loadAvailableSlots}
        timeout={20000} // Increased timeout for production
      >
        {loading && loadingProgress > 0 ? (
          <LoadingProgress 
            progress={loadingProgress} 
            message="Loading delivery availability..." 
          />
        ) : (
          renderContent()
        )}
      </ProgressiveLoader>
    </DeliverySchedulingErrorBoundary>
  );
};