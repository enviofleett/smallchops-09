/**
 * Lagos Timezone Utilities (Africa/Lagos, UTC+1)
 * Handles conversion between user input (Lagos time) and UTC for database storage
 */

import { format, parse } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const LAGOS_TIMEZONE = 'Africa/Lagos';

/**
 * Get current time in Lagos timezone
 */
export function getLagosTime(): Date {
  return toZonedTime(new Date(), LAGOS_TIMEZONE);
}

/**
 * Convert UTC date to Lagos timezone
 */
export function toLagosTime(date: Date): Date {
  return toZonedTime(date, LAGOS_TIMEZONE);
}

/**
 * Convert Lagos time to UTC for database storage
 * @param lagosDate - Date string in YYYY-MM-DD format
 * @param lagosTime - Time string in HH:mm format (Lagos local time)
 * @returns ISO string in UTC
 */
export function lagosToUTC(lagosDate: string, lagosTime: string): string {
  // Parse the Lagos date and time into a Date object
  const dateTimeStr = `${lagosDate}T${lagosTime}:00`;
  const lagosDateTime = parse(dateTimeStr, "yyyy-MM-dd'T'HH:mm:ss", new Date());
  
  // Convert from Lagos time to UTC
  const utcDate = fromZonedTime(lagosDateTime, LAGOS_TIMEZONE);
  
  return utcDate.toISOString();
}

/**
 * Format a UTC date as Lagos time string
 */
export function formatLagosTime(utcDate: Date | string, formatStr: string = 'PPpp'): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return formatInTimeZone(date, LAGOS_TIMEZONE, formatStr);
}

/**
 * Get start of day in Lagos timezone
 */
export function startOfDayLagos(date: Date = new Date()): Date {
  const lagosDate = toLagosTime(date);
  lagosDate.setHours(0, 0, 0, 0);
  return lagosDate;
}

/**
 * Get end of day in Lagos timezone
 */
export function endOfDayLagos(date: Date = new Date()): Date {
  const lagosDate = toLagosTime(date);
  lagosDate.setHours(23, 59, 59, 999);
  return lagosDate;
}

/**
 * Parse delivery date and time in Lagos timezone
 * Used for displaying and comparing delivery windows
 */
export function parseDeliveryDateTime(date: string, time: string): Date | null {
  try {
    const dateTimeStr = `${date}T${time}:00`;
    const parsed = parse(dateTimeStr, "yyyy-MM-dd'T'HH:mm:ss", new Date());
    
    // Treat as Lagos time
    return toZonedTime(parsed, LAGOS_TIMEZONE);
  } catch (error) {
    console.error('Error parsing delivery date/time:', error);
    return null;
  }
}

/**
 * Compare two dates in Lagos timezone
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareLagosDates(a: Date | null, b: Date | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  
  const aLagos = toLagosTime(a);
  const bLagos = toLagosTime(b);
  
  return aLagos.getTime() - bLagos.getTime();
}

/**
 * Check if a date is today in Lagos timezone
 */
export function isTodayLagos(date: Date): boolean {
  const lagosNow = getLagosTime();
  const lagosDate = toLagosTime(date);
  
  return lagosNow.toDateString() === lagosDate.toDateString();
}

/**
 * Get Lagos timezone offset string (e.g., "+01:00")
 */
export function getLagosOffset(): string {
  const now = new Date();
  const lagosTime = toLagosTime(now);
  const offset = formatInTimeZone(lagosTime, LAGOS_TIMEZONE, 'XXX');
  return offset;
}
