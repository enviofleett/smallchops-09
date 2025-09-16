import { OrderStatus } from '@/types/orders';

// Valid order status values that match the database enum
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
 * Validates if a status value is a valid OrderStatus
 */
export const isValidOrderStatus = (status: unknown): status is OrderStatus => {
  return typeof status === 'string' && VALID_ORDER_STATUSES.includes(status as OrderStatus);
};

/**
 * Safely validates and returns a valid OrderStatus or a fallback
 */
export const validateOrderStatus = (
  status: unknown, 
  fallback: OrderStatus = 'pending'
): OrderStatus => {
  if (isValidOrderStatus(status)) {
    return status;
  }
  
  console.warn(`Invalid order status provided: "${status}". Using fallback: "${fallback}"`);
  return fallback;
};

/**
 * Gets user-friendly status label
 */
export const getStatusLabel = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    completed: 'Completed',
    returned: 'Returned'
  };
  
  return labels[status] || status;
};