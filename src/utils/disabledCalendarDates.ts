/**
 * Utility functions for admin-managed disabled calendar dates
 * These dates are stored in business_settings.disabled_calendar_dates
 */

import { format } from 'date-fns';

/**
 * Check if a date is disabled via admin settings (database-driven)
 * @param date - The date to check
 * @param adminDisabledDates - Array of disabled dates in YYYY-MM-DD format
 * @returns Object with disabled status and optional reason
 */
export function isDateDisabledByAdmin(
  date: Date,
  adminDisabledDates?: string[] | null
): { disabled: boolean; reason?: string } {
  if (!adminDisabledDates?.length) {
    return { disabled: false };
  }

  const dateStr = format(date, 'yyyy-MM-dd');
  const isDisabled = adminDisabledDates.includes(dateStr);

  return {
    disabled: isDisabled,
    reason: isDisabled ? 'Date disabled by administrator' : undefined
  };
}

/**
 * Validate an array of date strings for correct format
 * @param dates - Array of date strings to validate
 * @returns Object with valid status and any invalid dates
 */
export function validateDisabledDatesFormat(dates: string[]): {
  valid: boolean;
  invalidDates: string[];
} {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const invalidDates = dates.filter(date => !dateRegex.test(date));
  
  return {
    valid: invalidDates.length === 0,
    invalidDates
  };
}

/**
 * Filter disabled dates to only include future dates
 * @param dates - Array of date strings in YYYY-MM-DD format
 * @returns Array of future disabled dates
 */
export function filterFutureDisabledDates(dates: string[]): string[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  return dates.filter(date => date >= today);
}
