import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Clock, AlertTriangle, Info } from 'lucide-react';
import { DeliveryTimeSlot } from '@/utils/deliveryScheduling';
import { isAfter, addDays, addMonths, isBefore, startOfDay, endOfDay, differenceInDays, isWeekend, addMinutes } from 'date-fns';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySchedulingErrorBoundary } from './DeliverySchedulingErrorBoundary';
import { HorizontalDatePicker } from './HorizontalDatePicker';
import { DropdownDatePicker } from './DropdownDatePicker';
import { useQuery } from '@tanstack/react-query';

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
  const [deliveryConfig, setDeliveryConfig] = useState<any>(null);

  // Production-ready query that fetches config and slots
  const {
    data: apiResponse,
    isLoading: loading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: ['delivery-availability', new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      try {
        const { deliveryBookingAPI } = await import('@/api/deliveryBookingApi');
        const now = new Date();
        const maxDate = addDays(now, 60); // 60 days from backend config
        
        const response = await deliveryBookingAPI.getAvailableSlots({
          start_date: deliveryBookingAPI.formatDateForAPI(now),
          end_date: deliveryBookingAPI.formatDateForAPI(maxDate)
        });
        
        console.log('✅ Delivery API response:', {
          slots: response.slots.length,
          config: response.config,
          businessDays: response.business_days
        });
        
        return response;
      } catch (err) {
        console.error('❌ Failed to fetch delivery slots:', err);
        
        // Provide clearer error for deployment issues
        if (err instanceof Error && 
            (err.message.includes('MIME type') || 
             err.message.includes('text/html') ||
             err.message.includes('temporarily unavailable'))) {
          throw new Error('Delivery scheduling is temporarily unavailable. Please try again in a few moments.');
        }
        
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: 2,
    retryDelay: 1000
  });

  const availableSlots = apiResponse?.slots || [];
  const config = apiResponse?.config;
  const error = queryError?.message || null;

  // Update delivery config when API response changes
  useEffect(() => {
    if (config) {
      setDeliveryConfig(config);
    }
  }, [config]);

  // Production-ready date validation using API config
  const dateValidation = useMemo(() => {
    const now = new Date();
    const leadTimeMinutes = deliveryConfig?.lead_time_minutes || 60;
    const maxAdvanceDays = deliveryConfig?.max_advance_days || 60;
    
    const minDate = startOfDay(now);
    const maxDate = addDays(startOfDay(now), maxAdvanceDays);
    
    return {
      minDate,
      maxDate,
      leadTimeMinutes,
      maxAdvanceDays,
      isDateInRange: (date: Date) => {
        const dayStart = startOfDay(date);
        return !isBefore(dayStart, minDate) && !isAfter(dayStart, maxDate);
      },
      isDateBlocked: (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const slot = availableSlots.find(s => s.date === dateStr);
        return slot?.is_holiday || false;
      },
      getMinimumBookingTime: () => {
        return addMinutes(now, leadTimeMinutes);
      },
      getDateDisabledReason: (date: Date) => {
        const dayStart = startOfDay(date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const slot = availableSlots.find(s => s.date === dateStr);
        
        if (isBefore(dayStart, minDate)) {
          return 'Past dates not available';
        }
        if (isAfter(dayStart, maxDate)) {
          return `Booking available up to ${maxAdvanceDays} days in advance`;
        }
        if (slot?.is_holiday) {
          return `Delivery not available - ${slot.holiday_name || 'Holiday'}`;
        }
        if (slot && !slot.is_business_day) {
          return 'Delivery not available on this date';
        }
        return null;
      }
    };
  }, [deliveryConfig, availableSlots]);

  // Enhanced date disabled function
  const isDateDisabled = useCallback((date: Date) => {
    if (!dateValidation.isDateInRange(date)) return true;
    if (dateValidation.isDateBlocked(date)) return true;
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
    
    // Check if date has available slots
    const dateStr = format(date, 'yyyy-MM-dd');
    const slot = availableSlots.find(s => s.date === dateStr);
    return !slot?.is_business_day;
  }, [dateValidation, availableSlots]);

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
                <div className="space-y-2">
                  <p className="font-semibold">Unable to load delivery schedule</p>
                  <p className="text-sm">
                    {error.includes('MIME type') || error.includes('text/html') || error.includes('temporarily unavailable')
                      ? 'The delivery scheduling service is temporarily unavailable. Please try refreshing the page.' 
                      : error}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                    Retry
                  </Button>
                </div>
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
                <div className="space-y-2">
                  <p className="font-semibold">Unable to load delivery schedule</p>
                  <p className="text-sm">
                    {error.includes('MIME type') || error.includes('text/html') || error.includes('temporarily unavailable')
                      ? 'The delivery scheduling service is temporarily unavailable. Please try refreshing the page.' 
                      : error}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                    Retry
                  </Button>
                </div>
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
                ⏰ <strong>Delivery Hours:</strong> Mon-Sat: 8:00AM - 7:00PM | Sunday: 10:00AM - 4:00PM
              </p>
              <p className="text-xs text-muted-foreground">
                🕐 <strong>Lead Time:</strong> Minimum {dateValidation.leadTimeMinutes} minutes from booking
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
                        booking closed
                      </span>
                    )}
                    {timeSlot.available && (
                      <span className="text-xs text-muted-foreground font-medium">Available</span>
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
