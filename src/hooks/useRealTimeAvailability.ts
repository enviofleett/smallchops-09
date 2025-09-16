import { useState, useEffect, useCallback } from 'react';
import { deliveryBookingAPI } from '@/api/deliveryBookingApi';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';

export interface RealTimeAvailability {
  isConflicted: boolean;
  currentCapacity: number;
  totalCapacity: number;
  utilizationPercentage: number;
  conflictingBookings: number;
  isSlotFull: boolean;
  recommendations: string[];
}

export interface UseRealTimeAvailabilityReturn {
  availability: RealTimeAvailability | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useRealTimeAvailability = (schedule: DeliverySchedule): UseRealTimeAvailabilityReturn => {
  const [availability, setAvailability] = useState<RealTimeAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async () => {
    if (!schedule || !schedule.delivery_date) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get availability for the specific date
      const response = await deliveryBookingAPI.getAvailableSlots({
        start_date: schedule.delivery_date,
        end_date: schedule.delivery_date
      });

      if (response.success && response.slots.length > 0) {
        const daySlot = response.slots[0];
        
        // Find the specific time slot
        const specificSlot = daySlot.time_slots.find(slot => 
          slot.start_time === schedule.delivery_time_start &&
          slot.end_time === schedule.delivery_time_end
        );

        if (specificSlot) {
          const currentCapacity = specificSlot.booked_count || 0;
          const totalCapacity = specificSlot.capacity || 10; // Default capacity
          const utilizationPercentage = Math.round((currentCapacity / totalCapacity) * 100);
          const isSlotFull = currentCapacity >= totalCapacity;
          const isConflicted = !specificSlot.available;

          const recommendations: string[] = [];
          
          if (isSlotFull) {
            recommendations.push('This time slot is fully booked. Consider rescheduling to another time.');
          } else if (utilizationPercentage > 80) {
            recommendations.push('This time slot is nearly full. Consider rescheduling for better service.');
          }

          if (isConflicted) {
            recommendations.push('This slot is no longer available due to capacity or business constraints.');
          }

          if (daySlot.is_holiday) {
            recommendations.push(`Scheduled on ${daySlot.holiday_name}. Consider rescheduling to a business day.`);
          }

          if (!daySlot.is_business_day) {
            recommendations.push('Scheduled on a non-business day. Consider rescheduling to a business day.');
          }

          setAvailability({
            isConflicted,
            currentCapacity,
            totalCapacity,
            utilizationPercentage,
            conflictingBookings: isConflicted ? 1 : 0,
            isSlotFull,
            recommendations
          });
        } else {
          // Slot not found - likely means it's no longer available
          setAvailability({
            isConflicted: true,
            currentCapacity: 0,
            totalCapacity: 0,
            utilizationPercentage: 100,
            conflictingBookings: 1,
            isSlotFull: true,
            recommendations: ['This time slot is no longer available. Please reschedule to an available time.']
          });
        }
      } else {
        throw new Error('Unable to fetch current availability data');
      }
    } catch (err) {
      console.error('Real-time availability check failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to check availability');
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  }, [schedule]);

  const refetch = useCallback(async () => {
    await checkAvailability();
  }, [checkAvailability]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  return {
    availability,
    loading,
    error,
    refetch
  };
};