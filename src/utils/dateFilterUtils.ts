import { startOfDay, endOfDay, addDays, subDays, isWithinInterval } from 'date-fns';
import { OrderWithItems } from '@/api/orders';

export type DeliveryFilterType = 'all' | 'due_today' | 'upcoming' | 'past_due' | 'this_week' | 'next_week';

/**
 * Production-ready utility functions for date-based order filtering
 */

export const getScheduleDateForOrder = (order: OrderWithItems, deliverySchedules: Record<string, any>) => {
  const schedule = deliverySchedules[order.id];
  if (schedule?.delivery_date) {
    try {
      const date = new Date(schedule.delivery_date);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.warn('Error parsing delivery date:', schedule.delivery_date, error);
      return null;
    }
  }
  return null;
};

export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  const normalizedDate = startOfDay(date);
  const normalizedStart = startOfDay(startDate);
  const normalizedEnd = startOfDay(endDate);
  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
};

export const getDateRangeForFilter = (filter: DeliveryFilterType, referenceDate: Date = new Date()) => {
  const today = startOfDay(referenceDate);
  const tomorrow = startOfDay(addDays(referenceDate, 1));
  const yesterday = startOfDay(subDays(referenceDate, 1));
  
  // Calculate week boundaries (Sunday to Saturday)
  const thisWeekStart = startOfDay(subDays(referenceDate, referenceDate.getDay()));
  const thisWeekEnd = endOfDay(addDays(thisWeekStart, 6));
  const nextWeekStart = startOfDay(addDays(thisWeekEnd, 1));
  const nextWeekEnd = endOfDay(addDays(nextWeekStart, 6));
  
  switch (filter) {
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
    // Only apply date filters to paid orders with valid schedules
    if (order.payment_status !== 'paid') {
      return false;
    }
    
    const scheduleDate = getScheduleDateForOrder(order, deliverySchedules);
    if (!scheduleDate) {
      return false;
    }
    
    const normalizedScheduleDate = startOfDay(scheduleDate);
    
    switch (filter) {
      case 'due_today':
        return normalizedScheduleDate.getTime() === dateRange.start.getTime();
      case 'past_due':
        return normalizedScheduleDate.getTime() < startOfDay(new Date()).getTime();
      case 'upcoming':
        return normalizedScheduleDate.getTime() > startOfDay(new Date()).getTime();
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
    due_today: 0,
    past_due: 0,
    upcoming: 0,
    this_week: 0,
    next_week: 0
  };
  
  const today = startOfDay(new Date());
  const dateRanges = {
    this_week: getDateRangeForFilter('this_week'),
    next_week: getDateRangeForFilter('next_week')
  };
  
  orders.forEach(order => {
    if (order.payment_status !== 'paid') return;
    
    const scheduleDate = getScheduleDateForOrder(order, deliverySchedules);
    if (!scheduleDate) return;
    
    const normalizedDate = startOfDay(scheduleDate);
    
    if (normalizedDate.getTime() === today.getTime()) {
      stats.due_today++;
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