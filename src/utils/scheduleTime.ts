import { parse, isValid } from 'date-fns';

/**
 * Parses a time string in various formats (HH:mm, h:mm a, etc.) and returns a Date object
 * for the given date with the parsed time
 */
export function parseScheduleTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;

  const baseDate = new Date(dateStr);
  if (!isValid(baseDate)) return null;

  // Clean the time string
  const cleanTime = timeStr.trim().toLowerCase();
  
  // Try different time formats
  const timeFormats = [
    'HH:mm',     // 24-hour format: "14:30"
    'H:mm',      // 24-hour format: "9:30"
    'h:mm a',    // 12-hour format: "2:30 pm"
    'h:mm aa',   // 12-hour format: "2:30 PM"
    'hh:mm a',   // 12-hour format: "02:30 pm"
    'hh:mm aa',  // 12-hour format: "02:30 PM"
  ];

  for (const format of timeFormats) {
    try {
      const parsedTime = parse(cleanTime, format, new Date());
      if (isValid(parsedTime)) {
        // Set the time on the base date
        const result = new Date(baseDate);
        result.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);
        return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Checks if an order is overdue based on delivery schedule
 */
export function isOrderOverdue(deliveryDate: string, deliveryTimeEnd: string): boolean {
  const endTime = parseScheduleTime(deliveryDate, deliveryTimeEnd);
  if (!endTime) return false;
  
  const now = new Date();
  return now > endTime;
}

/**
 * Calculates time until delivery start or elapsed time since delivery end
 */
export function calculateDeliveryTime(
  deliveryDate: string, 
  deliveryTimeStart: string, 
  deliveryTimeEnd: string
): {
  days: number;
  hours: number;
  minutes: number;
  status: 'upcoming' | 'today' | 'active' | 'passed' | 'within_two_hours';
  isOverdue: boolean;
} {
  const now = new Date();
  const startTime = parseScheduleTime(deliveryDate, deliveryTimeStart);
  const endTime = parseScheduleTime(deliveryDate, deliveryTimeEnd);

  // Default return value
  const defaultResult = {
    days: 0,
    hours: 0,
    minutes: 0,
    status: 'upcoming' as const,
    isOverdue: false
  };

  if (!startTime || !endTime) return defaultResult;

  // Check if currently in delivery window
  if (now >= startTime && now <= endTime) {
    return { ...defaultResult, status: 'active' };
  }

  // Check if delivery has passed
  if (now > endTime) {
    const overdueMs = now.getTime() - endTime.getTime();
    const overdueDays = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
    const overdueHours = Math.floor((overdueMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const overdueMinutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      days: overdueDays,
      hours: overdueHours,
      minutes: overdueMinutes,
      status: 'passed',
      isOverdue: true
    };
  }

  // Calculate time until delivery
  const diffMs = startTime.getTime() - now.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const totalMinutesUntil = Math.floor(diffMs / (1000 * 60));
  const isWithinTwoHours = totalMinutesUntil <= 120 && totalMinutesUntil > 0;

  const isToday = startTime.toDateString() === now.toDateString();

  return {
    days: Math.max(0, days),
    hours: Math.max(0, hours),
    minutes: Math.max(0, minutes),
    status: isWithinTwoHours ? 'within_two_hours' : (isToday ? 'today' : 'upcoming'),
    isOverdue: false
  };
}