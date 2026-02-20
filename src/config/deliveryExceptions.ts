/**
 * Centralized Delivery Schedule Exceptions Configuration
 * 
 * This file contains hardcoded delivery restrictions that override
 * database-driven scheduling. Easy to modify and reverse when dates pass.
 * 
 * Rules are enforced on BOTH frontend (UI) and backend (validation).
 */

/**
 * Fixed closed dates (recurring annually) - MM-DD format
 * Orders cannot be placed for delivery on these dates.
 */
export const FIXED_CLOSED_DATES: string[] = [
  '01-05', // January 5th - Closed for annual break
  '01-06', // January 6th - Closed for annual break  
  '01-07', // January 7th - Closed for annual break
];

/**
 * Special opening times for specific dates - YYYY-MM-DD format
 * On these dates, delivery slots only start from the specified time.
 */
export const SPECIAL_OPENING_TIMES: { date: string; hour: number; minute: number }[] = [
  { date: '2026-01-08', hour: 12, minute: 0 }, // Jan 8th 2026: Opens at 12 PM (noon)
];

/**
 * Pre-order cutoff dates - MM-DD format
 * Ordering closes at midnight (00:00) on these dates.
 * Orders must be placed BEFORE the date begins.
 */
export const PRE_ORDER_CUTOFF_DAYS: string[] = [
  '12-25', // December 25th - Orders must be placed before midnight Dec 25th
];

/**
 * Delivery disabled dates - YYYY-MM-DD format (one-off dates)
 * On these dates, only pickup is available. Delivery option is disabled.
 */
export const DELIVERY_DISABLED_DATES: string[] = [
  '2026-02-21', // February 21st 2026 - Pickup only
];

/**
 * Helper: Check if delivery is disabled on a given date
 */
export function isDeliveryDisabledOnDate(dateStr: string): boolean {
  return DELIVERY_DISABLED_DATES.includes(dateStr);
}

/**
 * Helper: Get reason delivery is disabled
 */
export function getDeliveryDisabledReason(dateStr: string): string {
  const reasons: Record<string, string> = {
    '2026-02-21': 'Delivery is not available on this date. Please select pickup.',
  };
  return reasons[dateStr] || 'Delivery is not available on this date';
}

/**
 * Helper: Get closure reason for a closed date
 */
export function getClosureReason(monthDay: string): string {
  const reasons: Record<string, string> = {
    '01-05': 'Store closed for annual break',
    '01-06': 'Store closed for annual break',
    '01-07': 'Store closed for annual break',
  };
  return reasons[monthDay] || 'Store closed';
}

/**
 * Helper: Get cutoff reason for a pre-order date
 */
export function getCutoffReason(monthDay: string): string {
  const reasons: Record<string, string> = {
    '12-25': 'Christmas Day - orders must be placed in advance',
  };
  return reasons[monthDay] || 'Ordering window has closed';
}
