import { startOfDay, endOfDay, addDays, subDays, isWithinInterval } from 'date-fns';
import { OrderWithItems } from '@/api/orders';
import { getLagosTime, toLagosTime, startOfDayLagos, endOfDayLagos, formatLagosTime, compareLagosDates } from './lagosTimezone';

export type DeliveryFilterType = 'all' | 'today' | 'tomorrow' | 'future' | 'due_today' | 'upcoming' | 'past_due' | 'this_week' | 'next_week';

/**
 * Production-ready utility functions for date-based order filtering
 * ALL dates are handled in Lagos timezone (Africa/Lagos - WAT, UTC+1)
 */

export const getScheduleDateForOrder = (order: OrderWithItems, deliverySchedules: Record<string, any>) => {
  const schedule = deliverySchedules[order.id];
  if (schedule?.delivery_date) {
    try {
      // Parse date in Lagos timezone
      const date = toLagosTime(schedule.delivery_date);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.warn('[LAGOS TZ] Error parsing delivery date:', schedule.delivery_date, error);
      return null;
    }
  }
  return null;
};

export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  const normalizedDate = startOfDayLagos(date);
  const normalizedStart = startOfDayLagos(startDate);
  const normalizedEnd = startOfDayLagos(endDate);
  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
};

export const getDateRangeForFilter = (filter: DeliveryFilterType, referenceDate: Date = getLagosTime()) => {
  const today = startOfDayLagos(referenceDate);
  const tomorrow = startOfDayLagos(addDays(referenceDate, 1));
  const yesterday = startOfDayLagos(subDays(referenceDate, 1));
  
  // Calculate week boundaries (Sunday to Saturday) in Lagos timezone
  const thisWeekStart = startOfDayLagos(subDays(referenceDate, referenceDate.getDay()));
  const thisWeekEnd = endOfDayLagos(addDays(thisWeekStart, 6));
  const nextWeekStart = startOfDayLagos(addDays(thisWeekEnd, 1));
  const nextWeekEnd = endOfDayLagos(addDays(nextWeekStart, 6));
  
  switch (filter) {
    case 'today':
      return { start: today, end: today, label: 'Today' };
    case 'tomorrow':
      return { start: tomorrow, end: tomorrow, label: 'Tomorrow' };
    case 'future':
      return { start: addDays(today, 2), end: new Date(2100, 0, 1), label: 'Future' };
    case 'due_today':
      return { start: today, end: today, label: 'Due Today' };
    case 'past_due':
      return { start: new Date(0), end: yesterday, label: 'Past Due' };
    case 'upcoming':
      return { start: tomorrow, end: new Date(2100, 0, 1), label: 'Future Orders' };
    case 'this_week':
      return { start: thisWeekStart, end: thisWeekEnd, label: 'This Week' };
    case 'next_week':
      return { start: nextWeekStart, end: nextWeekEnd, label: 'Next Week' };
    default:
      return null;
  }
};

export const filterOrdersByDate = (
  orders: OrderWithItems[], 
  filter: DeliveryFilterType, 
  deliverySchedules: Record<string, any>
): OrderWithItems[] => {
  if (filter === 'all') return orders;
  
  const dateRange = getDateRangeForFilter(filter);
  if (!dateRange) return orders;
  
  return orders.filter(order => {
    // Only apply date filters to orders with valid schedules
    // Payment status filtering is handled by tab selection
    const scheduleDate = getScheduleDateForOrder(order, deliverySchedules);
    if (!scheduleDate) {
      return false;
    }
    
    const normalizedScheduleDate = startOfDayLagos(scheduleDate);
    
    switch (filter) {
      case 'today':
        return normalizedScheduleDate.getTime() === dateRange.start.getTime();
      case 'tomorrow':
        return normalizedScheduleDate.getTime() === dateRange.start.getTime();
      case 'future':
        return normalizedScheduleDate.getTime() >= dateRange.start.getTime();
      case 'due_today':
        return normalizedScheduleDate.getTime() === dateRange.start.getTime();
      case 'past_due':
        return normalizedScheduleDate.getTime() < startOfDayLagos().getTime();
      case 'upcoming':
        return normalizedScheduleDate.getTime() > startOfDayLagos().getTime();
      case 'this_week':
      case 'next_week':
        return isDateInRange(scheduleDate, dateRange.start, dateRange.end);
      default:
        return true;
    }
  });
};

export const getFilterDescription = (
  filter: DeliveryFilterType,
  count: number,
  totalCount: number
): string => {
  const orderText = count === 1 ? 'order' : 'orders';
  
  switch (filter) {
    case 'today':
      return `Showing ${count} ${orderText} scheduled for today`;
    case 'tomorrow':
      return `Showing ${count} ${orderText} scheduled for tomorrow`;
    case 'future':
      return `Showing ${count} ${orderText} scheduled for future dates (day after tomorrow onwards)`;
    case 'due_today':
      return `Showing ${count} ${orderText} scheduled for today`;
    case 'past_due':
      return `${count} ${count === 1 ? 'order is' : 'orders are'} past their scheduled date`;
    case 'upcoming':
      return `${count} ${orderText} scheduled for future dates`;
    case 'this_week':
      return `${count} ${orderText} scheduled for this week`;
    case 'next_week':
      return `${count} ${orderText} scheduled for next week`;
    default:
      return `${count} of ${totalCount} orders match the current filter`;
  }
};

export const getFilterStats = (
  orders: OrderWithItems[], 
  deliverySchedules: Record<string, any>
) => {
  const stats = {
    all: orders.length,
    today: 0,
    tomorrow: 0,
    future: 0,
    due_today: 0,
    past_due: 0,
    upcoming: 0,
    this_week: 0,
    next_week: 0
  };
  
  const today = startOfDayLagos();
  const tomorrow = startOfDayLagos(addDays(getLagosTime(), 1));
  const dayAfterTomorrow = startOfDayLagos(addDays(getLagosTime(), 2));
  const dateRanges = {
    this_week: getDateRangeForFilter('this_week'),
    next_week: getDateRangeForFilter('next_week')
  };
  
  orders.forEach(order => {
    // Count all orders with valid schedules (payment status handled by tab)
    const scheduleDate = getScheduleDateForOrder(order, deliverySchedules);
    if (!scheduleDate) return;
    
    const normalizedDate = startOfDayLagos(scheduleDate);
    
    if (normalizedDate.getTime() === today.getTime()) {
      stats.today++;
      stats.due_today++;
    } else if (normalizedDate.getTime() === tomorrow.getTime()) {
      stats.tomorrow++;
    } else if (normalizedDate.getTime() >= dayAfterTomorrow.getTime()) {
      stats.future++;
    } else if (normalizedDate.getTime() < today.getTime()) {
      stats.past_due++;
    } else {
      stats.upcoming++;
    }
    
    if (dateRanges.this_week && isDateInRange(scheduleDate, dateRanges.this_week.start, dateRanges.this_week.end)) {
      stats.this_week++;
    }
    
    if (dateRanges.next_week && isDateInRange(scheduleDate, dateRanges.next_week.start, dateRanges.next_week.end)) {
      stats.next_week++;
    }
  });
  
  return stats;
};