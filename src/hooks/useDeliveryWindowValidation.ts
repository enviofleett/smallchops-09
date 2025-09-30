import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';
import { OrderType } from '@/types/unifiedOrder';

interface DeliveryWindowValidationResult {
  isValid: boolean;
  isCriticalError: boolean;
  errorMessage?: string;
  errorContext?: Record<string, any>;
}

/**
 * Validates delivery window data with fail-fast strategy.
 * For delivery orders, missing delivery windows are treated as CRITICAL ERRORS.
 * For pickup orders, this validation is more lenient.
 */
export const useDeliveryWindowValidation = (
  schedule: DeliverySchedule | null | undefined,
  orderType: OrderType,
  orderId?: string
): DeliveryWindowValidationResult => {
  
  useEffect(() => {
    // Log validation checks for monitoring
    if (orderType === 'delivery' && !isValidDeliverySchedule(schedule)) {
      logger.error('CRITICAL: Delivery order missing valid delivery window', {
        orderId,
        orderType,
        hasSchedule: !!schedule,
        scheduleData: schedule,
      });
    }
  }, [schedule, orderType, orderId]);

  // Delivery orders MUST have valid delivery windows
  if (orderType === 'delivery') {
    if (!schedule) {
      return {
        isValid: false,
        isCriticalError: true,
        errorMessage: 'Delivery window data is completely missing for this delivery order.',
        errorContext: {
          orderId,
          orderType,
          reason: 'NULL_SCHEDULE',
        },
      };
    }

    if (!schedule.delivery_date) {
      return {
        isValid: false,
        isCriticalError: true,
        errorMessage: 'Delivery date is missing from the delivery schedule.',
        errorContext: {
          orderId,
          orderType,
          reason: 'MISSING_DELIVERY_DATE',
          schedule,
        },
      };
    }

    if (!schedule.delivery_time_start || !schedule.delivery_time_end) {
      return {
        isValid: false,
        isCriticalError: true,
        errorMessage: 'Delivery time window is incomplete or missing.',
        errorContext: {
          orderId,
          orderType,
          reason: 'MISSING_TIME_WINDOW',
          hasStart: !!schedule.delivery_time_start,
          hasEnd: !!schedule.delivery_time_end,
          schedule,
        },
      };
    }

    // All required fields present
    return {
      isValid: true,
      isCriticalError: false,
    };
  }

  // For pickup orders, delivery schedule is optional
  if (orderType === 'pickup') {
    return {
      isValid: true,
      isCriticalError: false,
    };
  }

  // For other order types (dine_in, etc.), no validation needed
  return {
    isValid: true,
    isCriticalError: false,
  };
};

/**
 * Helper function to check if a delivery schedule is valid
 */
const isValidDeliverySchedule = (schedule: DeliverySchedule | null | undefined): boolean => {
  return !!(
    schedule &&
    schedule.delivery_date &&
    schedule.delivery_time_start &&
    schedule.delivery_time_end
  );
};

/**
 * Assertion function that throws if delivery window is invalid for delivery orders.
 * Use this when you want to fail fast and bubble up errors.
 */
export const assertDeliveryWindowValid = (
  schedule: DeliverySchedule | null | undefined,
  orderType: OrderType,
  orderId?: string
): void => {
  if (orderType !== 'delivery') return;

  if (!isValidDeliverySchedule(schedule)) {
    const error = new Error(
      `CRITICAL DATA INTEGRITY ERROR: Delivery order ${orderId || 'UNKNOWN'} is missing required delivery window data. This indicates a system failure.`
    );
    
    logger.error('Assertion failed: Invalid delivery window for delivery order', {
      orderId,
      orderType,
      schedule,
      stack: error.stack,
    });

    throw error;
  }
};
