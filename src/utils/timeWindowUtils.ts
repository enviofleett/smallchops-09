/**
 * Time Window Utilities
 * 
 * BUSINESS RULE: All delivery and pickup orders use a fixed 1-hour time window.
 * - For delivery orders: Use the `delivery_time` field as the window start
 * - For pickup orders: Use the `pickup_time` field as the window start
 * - The end time is always 1 hour after the start time
 * 
 * Example: If delivery_time is "09:00", display shows "9:00 AM - 10:00 AM"
 * 
 * This approach:
 * 1. Uses existing, reliable database fields (delivery_time, pickup_time)
 * 2. Eliminates dependency on order_delivery_schedule table for display
 * 3. Provides consistent 1-hour windows across all orders
 * 4. Simplifies data flow and reduces points of failure
 */

import { parse, isValid, addHours, format as formatDate } from 'date-fns';

export interface TimeWindow {
  start_time: string;
  end_time: string;
  start_time_24h: string;
  end_time_24h: string;
}

/**
 * Calculate a 1-hour time window from a start time
 * @param startTime - The start time string (e.g., "9:00 AM", "14:30", "09:00:00")
 * @returns TimeWindow object with formatted times, or null if parsing fails
 */
export const calculateTimeWindow = (
  startTime: string | null | undefined
): TimeWindow | null => {
  if (!startTime) return null;

  try {
    // Try parsing with common formats
    const timeFormats = ['HH:mm', 'h:mm a', 'h:mma', 'HH:mm:ss', 'h:mm:ss a', 'h a'];
    let parsedTime: Date | null = null;

    for (const formatStr of timeFormats) {
      const result = parse(startTime.trim(), formatStr, new Date());
      if (isValid(result)) {
        parsedTime = result;
        break;
      }
    }

    if (!parsedTime) {
      console.warn(`Failed to parse time: ${startTime}`);
      return null;
    }

    // Calculate end time (1 hour later)
    const endTime = addHours(parsedTime, 1);

    return {
      start_time: formatDate(parsedTime, 'h:mm a'),
      end_time: formatDate(endTime, 'h:mm a'),
      start_time_24h: formatDate(parsedTime, 'HH:mm'),
      end_time_24h: formatDate(endTime, 'HH:mm'),
    };
  } catch (error) {
    console.error('Error calculating time window:', error, { startTime });
    return null;
  }
};

/**
 * Get the appropriate time field based on order type
 * @param order - Order object
 * @returns The time string to use for window calculation
 */
export const getOrderTimeField = (order: {
  order_type: 'delivery' | 'pickup' | 'dine_in';
  delivery_time?: string | null;
  pickup_time?: string | null;
}): string | null => {
  if (order.order_type === 'delivery') {
    return order.delivery_time || null;
  }
  if (order.order_type === 'pickup') {
    return order.pickup_time || null;
  }
  return null;
};

/**
 * Get time window for an order
 * @param order - Order object
 * @returns TimeWindow or null
 */
export const getOrderTimeWindow = (order: {
  order_type: 'delivery' | 'pickup' | 'dine_in';
  delivery_time?: string | null;
  pickup_time?: string | null;
}): TimeWindow | null => {
  const timeField = getOrderTimeField(order);
  return calculateTimeWindow(timeField);
};

/**
 * Format time window for display
 * @param window - TimeWindow object
 * @returns Formatted string like "9:00 AM - 10:00 AM"
 */
export const formatTimeWindow = (window: TimeWindow | null): string => {
  if (!window) return 'Not specified';
  return `${window.start_time} - ${window.end_time}`;
};

/**
 * Check if order has valid time field for its type
 * @param order - Order object
 * @returns boolean indicating if time field exists
 */
export const hasValidTimeField = (order: {
  order_type: 'delivery' | 'pickup' | 'dine_in';
  delivery_time?: string | null;
  pickup_time?: string | null;
}): boolean => {
  if (order.order_type === 'delivery') {
    return !!order.delivery_time;
  }
  if (order.order_type === 'pickup') {
    return !!order.pickup_time;
  }
  return true; // dine_in doesn't require time field
};
