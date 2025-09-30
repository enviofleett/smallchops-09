import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { OrderType } from '@/types/unifiedOrder';

interface DeliveryWindowValidationResult {
  isValid: boolean;
  isCriticalError: boolean;
  errorMessage?: string;
  errorContext?: Record<string, any>;
}

/**
 * NEW VALIDATION LOGIC (Updated for time field-based windows):
 * 
 * For delivery orders: Validates that `delivery_time` field exists
 * For pickup orders: Validates that `pickup_time` field exists
 * 
 * This hook now validates the order-level time fields instead of the
 * order_delivery_schedule table, as these fields are the source of truth
 * for calculating 1-hour time windows.
 */
export const useDeliveryWindowValidation = (
  orderTimeField: string | null | undefined,
  orderType: OrderType,
  orderId?: string
): DeliveryWindowValidationResult => {
  
  useEffect(() => {
    // Log validation checks for monitoring
    if (orderType === 'delivery' && !orderTimeField) {
      logger.error('CRITICAL: Delivery order missing delivery_time field', {
        orderId,
        orderType,
        hasTimeField: !!orderTimeField,
      });
    }
    
    if (orderType === 'pickup' && !orderTimeField) {
      logger.warn('Pickup order missing pickup_time field', {
        orderId,
        orderType,
        hasTimeField: !!orderTimeField,
      });
    }
  }, [orderTimeField, orderType, orderId]);

  // Delivery orders MUST have delivery_time field
  if (orderType === 'delivery') {
    if (!orderTimeField) {
      return {
        isValid: false,
        isCriticalError: true,
        errorMessage: 'Delivery time is missing for this delivery order. This is a critical data error.',
        errorContext: {
          orderId,
          orderType,
          reason: 'MISSING_DELIVERY_TIME',
        },
      };
    }

    // All required fields present
    return {
      isValid: true,
      isCriticalError: false,
    };
  }

  // Pickup orders MUST have pickup_time field
  if (orderType === 'pickup') {
    if (!orderTimeField) {
      return {
        isValid: false,
        isCriticalError: true,
        errorMessage: 'Pickup time is missing for this pickup order. This is a critical data error.',
        errorContext: {
          orderId,
          orderType,
          reason: 'MISSING_PICKUP_TIME',
        },
      };
    }

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
 * Assertion function that throws if time field is invalid for delivery/pickup orders.
 * Use this when you want to fail fast and bubble up errors.
 */
export const assertTimeFieldValid = (
  orderTimeField: string | null | undefined,
  orderType: OrderType,
  orderId?: string
): void => {
  if (orderType === 'delivery' && !orderTimeField) {
    const error = new Error(
      `CRITICAL DATA INTEGRITY ERROR: Delivery order ${orderId || 'UNKNOWN'} is missing required delivery_time field. This indicates a system failure.`
    );
    
    logger.error('Assertion failed: Missing delivery_time for delivery order', {
      orderId,
      orderType,
      stack: error.stack,
    });

    throw error;
  }

  if (orderType === 'pickup' && !orderTimeField) {
    const error = new Error(
      `CRITICAL DATA INTEGRITY ERROR: Pickup order ${orderId || 'UNKNOWN'} is missing required pickup_time field. This indicates a system failure.`
    );
    
    logger.error('Assertion failed: Missing pickup_time for pickup order', {
      orderId,
      orderType,
      stack: error.stack,
    });

    throw error;
  }
};
