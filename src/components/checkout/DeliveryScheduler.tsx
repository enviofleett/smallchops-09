import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, AlertTriangle, Info } from 'lucide-react';
import { deliverySchedulingService, DeliverySlot, DeliveryTimeSlot } from '@/utils/deliveryScheduling';
import { isAfter, addDays, addMonths, isBefore, startOfDay, endOfDay, differenceInDays, isWeekend, addMinutes } from 'date-fns';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySchedulingErrorBoundary } from './DeliverySchedulingErrorBoundary';
import { HorizontalDatePicker } from './HorizontalDatePicker';
import { DropdownDatePicker } from './DropdownDatePicker';
import { useQuery } from '@tanstack/react-query';
import { CacheOptimizer } from '@/utils/optimizedQuery';

// Production-ready constants with business logic integration
const DELIVERY_BOOKING_CONSTANTS = {
  MIN_LEAD_TIME_MINUTES: 60, // 60 minutes from booking time
  MAX_ADVANCE_MONTHS: 2, // 2 months advance booking
  DELIVERY_WINDOW_START: '08:00', // 8am start (Mon-Sat)
  DELIVERY_WINDOW_END: '19:00', // 7pm end (Mon-Sat)
  SUNDAY_WINDOW_START: '10:00', // 10am start (Sunday)
  SUNDAY_WINDOW_END: '16:00', // 4pm end (Sunday)
  SLOT_DURATION_MINUTES: 60, // 1-hour slots
  BUSINESS_DAYS_ONLY: false, // Allow weekend deliveries
  BLOCKED_DATES: [] as Date[] // Holidays from business settings
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

export const DeliveryScheduler: React.FC<DeliverySchedulerProps> = memo(({
  selectedDate,
  selectedTimeSlot,
  onScheduleChange,
  className,
  showHeader = true,
  variant = 'calendar'
}) => {
  const [selectedDateSlots, setSelectedDateSlots] = useState<DeliveryTimeSlot[]>([]);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(selectedDate ? parseISO(selectedDate) : undefined);

  // Production-ready date validation with business logic
  const dateValidation = useMemo(() => {
    const now = new Date();
    const minDate = startOfDay(now); // Same day booking allowed if within lead time
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
      getMinimumBookingTime: () => {
        return addMinutes(now, DELIVERY_BOOKING_CONSTANTS.MIN_LEAD_TIME_MINUTES);
      },
      getDateDisabledReason: (date: Date) => {
        const dayStart = startOfDay(date);
        if (isBefore(dayStart, minDate)) {
          return 'Past dates not available';
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
          return 'Delivery not available on this date (holiday)';
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

  // Optimized query with caching
  const {
    data: availableSlots = [],
    isLoading: loading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: ['delivery-slots', format(dateValidation.minDate, 'yyyy-MM-dd'), format(dateValidation.maxDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const {
        deliveryBookingAPI
      } = await import('@/api/deliveryBookingApi');
      const response = await deliveryBookingAPI.getAvailableSlots({
        start_date: deliveryBookingAPI.formatDateForAPI(dateValidation.minDate),
        end_date: deliveryBookingAPI.formatDateForAPI(dateValidation.maxDate)
      });
      console.log('✅ Delivery slots received:', response.slots.length, 'slots');
      console.log('📊 Business days available:', response.business_days, 'of', response.total_days, 'total days');
      return response.slots.map(slot => ({
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
    },
    staleTime: 15 * 60 * 1000,
    // 15 minutes cache for static data
    refetchInterval: false,
    // Disable auto-refetch
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: 2
  });
  const error = queryError?.message || null;

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
          <CardContent className="space-y-6">
            {/* Fast-loading skeleton */}
            <div className="space-y-4">
              <div className="h-4 bg-muted animate-pulse rounded w-1/3"></div>
              <div className="h-3 bg-muted animate-pulse rounded w-2/3"></div>
            </div>
            <div className="w-full h-64 bg-muted animate-pulse rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded w-1/4"></div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({
                  length: 6
                }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </DeliverySchedulingErrorBoundary>
    );
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
                <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-2">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Date Picker - Responsive */}
          <div className="block sm:hidden">
            <DropdownDatePicker 
              selectedDate={selectedDate} 
              availableSlots={availableSlots} 
              onDateSelect={handleHorizontalDateSelect} 
            />
          </div>
          <div className="hidden sm:block">
            <HorizontalDatePicker 
              selectedDate={selectedDate} 
              availableSlots={availableSlots} 
              onDateSelect={handleHorizontalDateSelect} 
            />
          </div>

          {/* Time Slots Section */}
          {calendarDate && selectedDateSlots.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Select delivery time
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {selectedDateSlots.map((timeSlot, index) => {
                  const isSelected = selectedTimeSlot?.start_time === timeSlot.start_time && selectedTimeSlot?.end_time === timeSlot.end_time;
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

  return (
    <DeliverySchedulingErrorBoundary>
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
                <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-2">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Date Picker - Mobile Optimized */}
          <div className="space-y-4">
            
            {/* Always use dropdown for better UX */}
            <DropdownDatePicker 
              selectedDate={selectedDate} 
              availableSlots={availableSlots} 
              onDateSelect={handleHorizontalDateSelect} 
            />
          </div>
          
          {/* Booking Information - Production Ready */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="space-y-2">
              <p className="text-sm text-primary font-medium">
                📅 <strong>Booking Window:</strong> {format(dateValidation.minDate, 'MMM d')} - {format(dateValidation.maxDate, 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                ⏰ <strong>Delivery Hours:</strong> Mon-Sat: {DELIVERY_BOOKING_CONSTANTS.DELIVERY_WINDOW_START} - {DELIVERY_BOOKING_CONSTANTS.DELIVERY_WINDOW_END} | Sun: {DELIVERY_BOOKING_CONSTANTS.SUNDAY_WINDOW_START} - {DELIVERY_BOOKING_CONSTANTS.SUNDAY_WINDOW_END}
              </p>
              <p className="text-xs text-muted-foreground">
                🕐 <strong>Lead Time:</strong> Minimum {DELIVERY_BOOKING_CONSTANTS.MIN_LEAD_TIME_MINUTES} minutes from booking
              </p>
            </div>
          </div>

          {/* Date Selection Feedback */}
          {calendarDate && (
            <div className="text-sm text-muted-foreground bg-green-50 border border-green-200 rounded-lg p-3">
              ✅ Selected: <strong>{format(calendarDate, 'EEEE, MMMM d, yyyy')}</strong>
              {differenceInDays(calendarDate, new Date()) > 7 && (
                <div className="mt-1 text-blue-600">
                  ℹ️ Advanced booking - {differenceInDays(calendarDate, new Date())} days from today
                </div>
              )}
            </div>
          )}

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

          {/* No Slots Available Alert */}
          {calendarDate && selectedDateSlots.length === 0 && !selectedSlot?.is_holiday && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                No delivery slots available for the selected date. Please choose a different date or contact support for assistance.
              </AlertDescription>
            </Alert>
          )}

          {/* Holiday Alert */}
          {selectedSlot?.is_holiday && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Selected date is a holiday. Delivery is not available on this date.
              </AlertDescription>
            </Alert>
          )}

          {/* Delivery Summary - Enhanced with Booking Timeline */}
          {selectedDate && selectedTimeSlot && (
            <div className="pt-6 border-t border-border/50">
              <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Delivery Schedule Summary
              </h4>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium whitespace-nowrap bg-primary/10 text-primary border-primary/20">
                    📅 {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium whitespace-nowrap bg-green-100 text-green-800 border-green-200">
                    🕒 {selectedTimeSlot.start_time} - {selectedTimeSlot.end_time}
                  </Badge>
                  {differenceInDays(parseISO(selectedDate), new Date()) > 30 && (
                    <Badge variant="outline" className="px-3 py-1.5 text-sm font-medium whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200">
                      🚀 Advanced Booking
                    </Badge>
                  )}
                </div>

                {/* Booking Timeline Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Booking Details</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Days ahead: <strong>{differenceInDays(parseISO(selectedDate), new Date())}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Booking window: <strong>Valid until {format(dateValidation.maxDate, 'MMM d, yyyy')}</strong>
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-sm text-green-800">Delivery Notes</span>
                    </div>
                    <p className="text-sm text-green-700 leading-relaxed">
                      📍 Please ensure someone is available to receive the delivery during this time window. Our delivery team will contact you 30 minutes before arrival.
                    </p>
                  </div>
                </div>

                {/* Production Features */}
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚡ <strong>Production Features:</strong> 6-month advance booking • Smart date validation • Business day filtering • Holiday detection
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Booking Notice */}
          {selectedDate && differenceInDays(parseISO(selectedDate), new Date()) > 90 && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Long-term booking:</strong> You're booking {differenceInDays(parseISO(selectedDate), new Date())} days in advance. 
                We'll send you a confirmation reminder 1 week before your delivery date.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </DeliverySchedulingErrorBoundary>
  );
});
