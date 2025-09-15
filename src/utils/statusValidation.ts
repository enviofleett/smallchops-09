/**
 * Comprehensive status validation utilities to prevent enum injection errors
 */

import type { OrderStatus } from '@/types/orders';

// Define allowed status values (must match database enum)
export const VALID_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed', 
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
  'completed',
  'returned'
];

/**
 * Validates if a status value is valid for the order_status enum
 */
export const isValidOrderStatus = (status: unknown): status is OrderStatus => {
  return typeof status === 'string' && 
         status.trim() !== '' &&
         status !== 'undefined' && 
         status !== 'null' &&
         VALID_ORDER_STATUSES.includes(status as OrderStatus);
};

/**
 * Sanitizes and validates a status value, throwing an error if invalid
 */
export const validateAndSanitizeStatus = (status: unknown): OrderStatus => {
  if (!isValidOrderStatus(status)) {
    const validStatusList = VALID_ORDER_STATUSES.join(', ');
    throw new Error(
      `Invalid order status: "${status}" (type: ${typeof status}). Valid statuses are: ${validStatusList}`
    );
  }
  return status;
};

/**
 * Safe status validator that returns null instead of throwing
 */
export const safeValidateStatus = (status: unknown): OrderStatus | null => {
  try {
    return validateAndSanitizeStatus(status);
  } catch {
    return null;
  }
};

/**
 * Validates status transition rules (business logic)
 */
export const isValidStatusTransition = (
  currentStatus: OrderStatus, 
  newStatus: OrderStatus,
  hasAssignedRider: boolean = false
): { isValid: boolean; reason?: string } => {
  // Special business rule: cannot move to out_for_delivery without rider
  if (newStatus === 'out_for_delivery' && !hasAssignedRider) {
    return {
      isValid: false,
      reason: 'Cannot move to "Out for Delivery" without assigning a driver'
    };
  }

  // Add other business rules here as needed
  // For now, allow all other transitions
  return { isValid: true };
};