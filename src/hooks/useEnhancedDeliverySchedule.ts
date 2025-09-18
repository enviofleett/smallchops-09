import { useState, useEffect } from 'react';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';
import { deliveryBookingAPI, DeliverySlot } from '@/api/deliveryBookingApi';
import { deliverySchedulingService } from '@/utils/deliveryScheduling';
import { format, parseISO, isBefore, isAfter, isWeekend, setHours, setMinutes, startOfDay } from 'date-fns';

export interface ScheduleValidationResult {
  isValid: boolean;
  warnings: ScheduleWarning[];
  businessContext: BusinessContext;
}

export interface ScheduleWarning {
  type: 'holiday' | 'past_date' | 'non_business_hours' | 'weekend' | 'capacity' | 'lead_time';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation?: string;
}

export interface BusinessContext {
  isHoliday: boolean;
  holidayName?: string;
  isBusinessDay: boolean;
  businessHours?: {
    open: string;
    close: string;
  };
  slotAvailability?: {
    available: boolean;
    capacity?: number;
    bookedCount?: number;
    reason?: string;
  };
}

export const useEnhancedDeliverySchedule = (schedule: DeliverySchedule | null) => {
  const [validation, setValidation] = useState<ScheduleValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schedule) {
      setValidation(null);
      return;
    }

    const validateSchedule = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const warnings: ScheduleWarning[] = [];
        const businessContext: BusinessContext = {
          isHoliday: false,
          isBusinessDay: true
        };

        const scheduleDate = parseISO(schedule.delivery_date);
        const now = new Date();
        
        // Create actual delivery datetime by combining date and start time
        let deliveryDateTime = scheduleDate;
        if (schedule.delivery_time_start) {
          try {
            const [hours, minutes] = schedule.delivery_time_start.split(':').map(Number);
            deliveryDateTime = setMinutes(setHours(scheduleDate, hours), minutes);
          } catch (error) {
            console.warn('Could not parse delivery time:', schedule.delivery_time_start);
            // Fallback to end of day if time parsing fails
            deliveryDateTime = setHours(scheduleDate, 23);
          }
        }

        // Initialize delivery scheduling service
        await deliverySchedulingService.initialize();

        // Check if delivery datetime is in the past (with 30-minute buffer)
        const bufferTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
        if (isBefore(deliveryDateTime, bufferTime)) {
          // Only show as past if the entire delivery window has passed
          let deliveryEndDateTime = deliveryDateTime;
          if (schedule.delivery_time_end) {
            try {
              const [endHours, endMinutes] = schedule.delivery_time_end.split(':').map(Number);
              deliveryEndDateTime = setMinutes(setHours(scheduleDate, endHours), endMinutes);
            } catch (error) {
              // If end time parsing fails, assume 1-hour window
              deliveryEndDateTime = new Date(deliveryDateTime.getTime() + 60 * 60 * 1000);
            }
          }

          // Only show warning if the entire delivery window has passed
          if (isBefore(deliveryEndDateTime, now)) {
            warnings.push({
              type: 'past_date',
              severity: 'error',
              message: 'This delivery window has already passed',
              recommendation: 'Contact customer to reschedule'
            });
          } else {
            // Delivery window is active or starting soon
            warnings.push({
              type: 'lead_time',
              severity: 'info',
              message: 'Delivery window is approaching soon',
              recommendation: 'Ensure order is prepared for delivery'
            });
          }
        }

        // Check for holidays and business days
        try {
          const availabilityRequest = {
            start_date: format(scheduleDate, 'yyyy-MM-dd'),
            end_date: format(scheduleDate, 'yyyy-MM-dd')
          };

          const availabilityResponse = await deliveryBookingAPI.getAvailableSlots(availabilityRequest);
          
          if (availabilityResponse.success && availabilityResponse.slots.length > 0) {
            const daySlot = availabilityResponse.slots[0];
            
            businessContext.isHoliday = daySlot.is_holiday;
            businessContext.holidayName = daySlot.holiday_name;
            businessContext.isBusinessDay = daySlot.is_business_day;

            if (daySlot.is_holiday) {
              warnings.push({
                type: 'holiday',
                severity: 'warning',
                message: `Scheduled on ${daySlot.holiday_name}`,
                recommendation: 'Verify if delivery service is available on this holiday'
              });
            }

            if (!daySlot.is_business_day) {
              warnings.push({
                type: 'non_business_hours',
                severity: 'warning',
                message: 'Scheduled on a non-business day',
                recommendation: 'Confirm delivery availability with operations team'
              });
            }

            // Check time slot availability
            const timeSlot = daySlot.time_slots.find(slot => 
              slot.start_time === schedule.delivery_time_start && 
              slot.end_time === schedule.delivery_time_end
            );

            if (timeSlot) {
              businessContext.slotAvailability = {
                available: timeSlot.available,
                capacity: timeSlot.capacity,
                bookedCount: timeSlot.booked_count,
                reason: timeSlot.reason
              };

              if (!timeSlot.available) {
                warnings.push({
                  type: 'capacity',
                  severity: 'error',
                  message: timeSlot.reason || 'Time slot is no longer available',
                  recommendation: 'Reschedule to an available time slot'
                });
              } else if (timeSlot.capacity && timeSlot.booked_count && 
                        timeSlot.booked_count >= timeSlot.capacity * 0.8) {
                warnings.push({
                  type: 'capacity',
                  severity: 'info',
                  message: 'Time slot is nearly full',
                  recommendation: 'Monitor capacity and consider alternative slots'
                });
              }
            }
          }
        } catch (apiError) {
          console.warn('Could not fetch delivery availability:', apiError);
          // Continue with basic validation
        }

        // Check if it's a weekend
        if (isWeekend(scheduleDate)) {
          warnings.push({
            type: 'weekend',
            severity: 'info',
            message: 'Scheduled for weekend delivery',
            recommendation: 'Confirm weekend delivery service is available'
          });
        }

        const isValid = !warnings.some(w => w.severity === 'error');

        setValidation({
          isValid,
          warnings,
          businessContext
        });

      } catch (err) {
        console.error('Error validating schedule:', err);
        setError(err instanceof Error ? err.message : 'Failed to validate schedule');
      } finally {
        setLoading(false);
      }
    };

    validateSchedule();
  }, [schedule]);

  return {
    validation,
    loading,
    error,
    refetch: () => {
      if (schedule) {
        const validateSchedule = async () => {
          setLoading(true);
          setError(null);
          // Re-run validation logic
        };
        validateSchedule();
      }
    }
  };
};