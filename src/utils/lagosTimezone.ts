import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

/**
 * Production-ready Lagos timezone utilities
 * Uses Africa/Lagos (WAT - West Africa Time, UTC+1)
 */

export const LAGOS_TIMEZONE = 'Africa/Lagos';

/**
 * Get current Lagos time
 */
export function getLagosTime(): Date {
  return toZonedTime(new Date(), LAGOS_TIMEZONE);
}

/**
 * Convert any date to Lagos timezone
 */
export function toLagosTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, LAGOS_TIMEZONE);
}

/**
 * Convert Lagos time to UTC
 */
export function lagosToUTC(lagosDate: Date): Date {
  return fromZonedTime(lagosDate, LAGOS_TIMEZONE);
}

/**
 * Format date in Lagos timezone
 */
export function formatLagosTime(date: Date | string, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, LAGOS_TIMEZONE, formatStr);
}

/**
 * Get start of day in Lagos timezone
 */
export function startOfDayLagos(date?: Date | string): Date {
  const lagosDate = date ? toLagosTime(date) : getLagosTime();
  const formatted = formatInTimeZone(lagosDate, LAGOS_TIMEZONE, 'yyyy-MM-dd');
  return toZonedTime(new Date(`${formatted}T00:00:00`), LAGOS_TIMEZONE);
}

/**
 * Get end of day in Lagos timezone
 */
export function endOfDayLagos(date?: Date | string): Date {
  const lagosDate = date ? toLagosTime(date) : getLagosTime();
  const formatted = formatInTimeZone(lagosDate, LAGOS_TIMEZONE, 'yyyy-MM-dd');
  return toZonedTime(new Date(`${formatted}T23:59:59`), LAGOS_TIMEZONE);
}

/**
 * Check if a date is today in Lagos timezone
 */
export function isTodayLagos(date: Date | string): boolean {
  const lagosDate = toLagosTime(date);
  const today = getLagosTime();
  
  return formatInTimeZone(lagosDate, LAGOS_TIMEZONE, 'yyyy-MM-dd') === 
         formatInTimeZone(today, LAGOS_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Check if a date is tomorrow in Lagos timezone
 */
export function isTomorrowLagos(date: Date | string): boolean {
  const lagosDate = toLagosTime(date);
  const today = getLagosTime();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return formatInTimeZone(lagosDate, LAGOS_TIMEZONE, 'yyyy-MM-dd') === 
         formatInTimeZone(tomorrow, LAGOS_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Compare two dates in Lagos timezone (returns difference in milliseconds)
 */
export function compareLagosDates(date1: Date | string, date2: Date | string): number {
  const lagos1 = toLagosTime(date1);
  const lagos2 = toLagosTime(date2);
  return lagos1.getTime() - lagos2.getTime();
}

/**
 * Get Lagos date string (YYYY-MM-DD format)
 */
export function getLagosDateString(date?: Date | string): string {
  const lagosDate = date ? toLagosTime(date) : getLagosTime();
  return formatInTimeZone(lagosDate, LAGOS_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Parse delivery time in Lagos timezone
 */
export function parseDeliveryDateTime(deliveryDate: string, deliveryTime: string): Date {
  const dateTimeStr = `${deliveryDate}T${deliveryTime}`;
  return toZonedTime(new Date(dateTimeStr), LAGOS_TIMEZONE);
}
