import { parseISO, format, addHours, isValid } from 'date-fns';

/**
 * DELIVERY WINDOW LOGIC (Production Rule):
 * - All delivery/pickup orders use a FIXED 1-HOUR WINDOW
 * - For delivery orders: Uses order.delivery_time as start
 * - For pickup orders: Uses order.pickup_time as start
 * - Window end = start time + 1 hour
 * - Example: 9:00 AM → "9:00 AM - 10:00 AM"
 */

interface TimeWindow {
  startTime: Date;
  endTime: Date;
  startFormatted: string;
  endFormatted: string;
}

/**
 * Parses a timestamp string and calculates a 1-hour time window
 * Handles both full timestamps (2025-10-02 10:00:00+00) and time-only formats (10:00 AM)
 */
export function calculateTimeWindow(timestamp: string | null | undefined): TimeWindow | null {
  if (!timestamp) return null;

  try {
    let startTime: Date;

    // Try parsing as full ISO timestamp first
    if (timestamp.includes('T') || timestamp.includes('+') || timestamp.includes('Z')) {
      startTime = parseISO(timestamp);
    } 
    // Try parsing date + time format (2025-10-02 10:00:00)
    else if (timestamp.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
      startTime = parseISO(timestamp.replace(' ', 'T'));
    }
    // Handle time-only format (10:00 AM or 10:00)
    else if (timestamp.match(/^\d{1,2}:\d{2}/)) {
      const today = new Date();
      const [hours, minutes] = timestamp.split(':').map(num => parseInt(num));
      startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    }
    // Fallback: try direct Date parsing
    else {
      startTime = new Date(timestamp);
    }

    // Validate parsed date
    if (!isValid(startTime)) {
      console.warn('Invalid timestamp provided:', timestamp);
      return null;
    }

    // Calculate end time (start + 1 hour)
    const endTime = addHours(startTime, 1);

    return {
      startTime,
      endTime,
      startFormatted: format(startTime, 'h:mm a'),
      endFormatted: format(endTime, 'h:mm a')
    };
  } catch (error) {
    console.error('Error calculating time window:', error, timestamp);
    return null;
  }
}

/**
 * Gets the formatted time window string for an order
 * Returns "9:00 AM - 10:00 AM" format
 */
export function getOrderTimeWindow(order: { 
  order_type?: string;
  delivery_time?: string | null;
  pickup_time?: string | null;
}): string | null {
  const timeField = order.order_type === 'pickup' ? order.pickup_time : order.delivery_time;
  
  if (!timeField) {
    console.error('CRITICAL: Missing time field for order type:', order.order_type);
    return null;
  }

  const window = calculateTimeWindow(timeField);
  if (!window) return null;

  return `${window.startFormatted} - ${window.endFormatted}`;
}

/**
 * Validates that an order has the required time field
 */
export function hasValidTimeField(order: { 
  order_type?: string;
  delivery_time?: string | null;
  pickup_time?: string | null;
}): boolean {
  if (order.order_type === 'pickup') {
    return !!order.pickup_time;
  }
  return !!order.delivery_time;
}

/**
 * Formats a date string for display
 */
export function formatDeliveryDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return null;
    return format(date, 'MMM dd, yyyy');
  } catch {
    return null;
  }
}
