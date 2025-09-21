import { startOfDay, endOfDay, addDays, subDays, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { OrderWithItems } from '@/api/orders';

export type DeliveryFilterType = 'all' | 'today' | 'tomorrow' | 'future' | 'due_today' | 'upcoming' | 'past_due' | 'this_week' | 'next_week';

/**
 * Production-ready utility functions for date-based order filtering
 * Enhanced with comprehensive error handling and performance optimizations
 */

// Cache for date calculations to improve performance
const dateCache = new Map<string, Date>();

const getCachedDate = (key: string, computation: () => Date): Date => {
  if (!dateCache.has(key)) {
    dateCache.set(key, computation());
  }
  return dateCache.get(key)!;
};

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  if (dateCache.size > 100) {
    dateCache.clear();
  }
}, 60000); // Clear every minute if cache gets too large

export const getScheduleDateForOrder = (order: OrderWithItems, deliverySchedules: Record<string, any>): Date | null => {
  if (!order?.id || !deliverySchedules) {
    return null;
  }

  const schedule = deliverySchedules[order.id];
  if (!schedule?.delivery_date) {
    return null;
  }

  try {
    // Handle various date formats
    const dateStr = schedule.delivery_date;
    let date: Date;

    if (typeof dateStr === 'string') {
      // Handle ISO strings, date-only strings, etc.
      date = new Date(dateStr);
    } else if (dateStr instanceof Date) {
      date = dateStr;
    } else {
      console.warn('Invalid delivery date format for order:', order.id, dateStr);
      return null;
    }

    // Validate the parsed date
    if (isNaN(date.getTime())) {
      console.warn('Invalid delivery date for order:', order.id, dateStr);
      return null;
    }

    return date;
  } catch (error) {
    console.warn('Error parsing delivery date for order:', order.id, schedule.delivery_date, error);
    return null;
  }
};

export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  if (!date || !startDate || !endDate) {
    return false;
  }

  try {
    const normalizedDate = startOfDay(date);
    const normalizedStart = startOfDay(startDate);
    const normalizedEnd = startOfDay(endDate);
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
  } catch (error) {
    console.warn('Error in date range check:', error);
    return false;
  }
};

export const getDateRangeForFilter = (filter: DeliveryFilterType, referenceDate: Date = new Date()) => {
  if (!referenceDate || isNaN(referenceDate.getTime())) {
    referenceDate = new Date();
  }

  const cacheKey = `${filter}-${referenceDate.toDateString()}`;
  
  try {
    const today = getCachedDate(`today-${referenceDate.toDateString()}`, () => startOfDay(referenceDate));
    const tomorrow = getCachedDate(`tomorrow-${referenceDate.toDateString()}`, () => startOfDay(addDays(referenceDate, 1)));
    const yesterday = getCachedDate(`yesterday-${referenceDate.toDateString()}`, () => startOfDay(subDays(referenceDate, 1)));
    
    // Calculate week boundaries (Monday to Sunday)
    const thisWeekStart = getCachedDate(`thisWeekStart-${referenceDate.toDateString()}`, () => startOfWeek(referenceDate, { weekStartsOn: 1 }));
    const thisWeekEnd = getCachedDate(`thisWeekEnd-${referenceDate.toDateString()}`, () => endOfWeek(referenceDate, { weekStartsOn: 1 }));
    const nextWeekStart = getCachedDate(`nextWeekStart-${referenceDate.toDateString()}`, () => startOfWeek(addDays(referenceDate, 7), { weekStartsOn: 1 }));
    const nextWeekEnd = getCachedDate(`nextWeekEnd-${referenceDate.toDateString()}`, () => endOfWeek(addDays(referenceDate, 7), { weekStartsOn: 1 }));
    
    switch (filter) {
      case 'today':
        return { start: today, end: today, label: 'Today' };
      case 'tomorrow':
        return { start: tomorrow, end: tomorrow, label: 'Tomorrow' };
      case 'future':
        return { start: addDays(today, 2), end: new Date(2100, 0, 1), label: 'Future (Day After Tomorrow+)' };
      case 'due_today':
        return { start: today, end: today, label: 'Due Today' };
      case 'past_due':
        return { start: new Date(0), end: yesterday, label: 'Past Due' };
      case 'upcoming':
        return { start: tomorrow, end: new Date(2100, 0, 1), label: 'Upcoming Orders' };
      case 'this_week':
        return { start: thisWeekStart, end: thisWeekEnd, label: 'This Week' };
      case 'next_week':
        return { start: nextWeekStart, end: nextWeekEnd, label: 'Next Week' };
      default:
        return null;
    }
  } catch (error) {
    console.error('Error calculating date range for filter:', filter, error);
    return null;
  }
};

export const filterOrdersByDate = (
  orders: OrderWithItems[], 
  filter: DeliveryFilterType, 
  deliverySchedules: Record<string, any>
): OrderWithItems[] => {
  if (filter === 'all' || !orders?.length) {
    return orders || [];
  }
  
  const dateRange = getDateRangeForFilter(filter);
  if (!dateRange) {
    return orders;
  }
  
  const today = startOfDay(new Date());
  let filteredOrders: OrderWithItems[] = [];
  
  try {
    filteredOrders = orders.filter(order => {
      try {
        // Enhanced order validation
        if (!order?.id) {
          console.warn('Order missing ID:', order);
          return false;
        }

        // Only filter paid orders for production reliability
        if (order.payment_status !== 'paid') {
          return false;
        }
        
        const scheduleDate = getScheduleDateForOrder(order, deliverySchedules);
        if (!scheduleDate) {
          // For debugging: log orders without schedules
          if (process.env.NODE_ENV === 'development') {
            console.debug('Order without schedule:', order.id, order.order_number);
          }
          return false;
        }
        
        const normalizedScheduleDate = startOfDay(scheduleDate);
        
        // Optimized date comparison using timestamps
        const scheduleDateTimestamp = normalizedScheduleDate.getTime();
        const todayTimestamp = today.getTime();
        
        switch (filter) {
          case 'today':
          case 'due_today':
            return scheduleDateTimestamp === todayTimestamp;
          case 'tomorrow':
            return scheduleDateTimestamp === addDays(today, 1).getTime();
          case 'future':
            return scheduleDateTimestamp >= addDays(today, 2).getTime();
          case 'past_due':
            return scheduleDateTimestamp < todayTimestamp;
          case 'upcoming':
            return scheduleDateTimestamp > todayTimestamp;
          case 'this_week':
          case 'next_week':
            return isDateInRange(scheduleDate, dateRange.start, dateRange.end);
          default:
            return true;
        }
      } catch (orderError) {
        console.warn('Error processing order in date filter:', order?.id, orderError);
        return false;
      }
    });
  } catch (error) {
    console.error('Critical error in filterOrdersByDate:', error);
    // Return original orders if filtering fails completely
    return orders;
  }
  
  return filteredOrders;
};

export const getFilterDescription = (
  filter: DeliveryFilterType,
  count: number,
  totalCount: number
): string => {
  const orderText = count === 1 ? 'order' : 'orders';
  
  try {
    switch (filter) {
      case 'today':
        return `Showing ${count} ${orderText} scheduled for delivery today`;
      case 'tomorrow':
        return `Showing ${count} ${orderText} scheduled for delivery tomorrow`;
      case 'future':
        return `Showing ${count} ${orderText} scheduled for future dates (day after tomorrow onwards)`;
      case 'due_today':
        return `Showing ${count} ${orderText} due for delivery today`;
      case 'past_due':
        return `⚠️ ${count} ${count === 1 ? 'order is' : 'orders are'} past their scheduled delivery date`;
      case 'upcoming':
        return `📅 ${count} ${orderText} scheduled for upcoming dates`;
      case 'this_week':
        return `📊 ${count} ${orderText} scheduled for delivery this week`;
      case 'next_week':
        return `📅 ${count} ${orderText} scheduled for delivery next week`;
      case 'all':
      default:
        return `Showing ${count} of ${totalCount} total orders`;
    }
  } catch (error) {
    console.warn('Error generating filter description:', error);
    return `${count} ${orderText} match the current filter`;
  }
};

export const getFilterStats = (
  orders: OrderWithItems[], 
  deliverySchedules: Record<string, any>
) => {
  const stats = {
    all: 0,
    today: 0,
    tomorrow: 0,
    future: 0,
    due_today: 0,
    past_due: 0,
    upcoming: 0,
    this_week: 0,
    next_week: 0
  };
  
  if (!orders?.length) {
    return stats;
  }
  
  stats.all = orders.length;
  
  try {
    const today = startOfDay(new Date());
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const dayAfterTomorrow = startOfDay(addDays(new Date(), 2));
    
    const dateRanges = {
      this_week: getDateRangeForFilter('this_week'),
      next_week: getDateRangeForFilter('next_week')
    };
    
    orders.forEach(order => {
      try {
        if (!order?.id || order.payment_status !== 'paid') {
          return;
        }
        
        const scheduleDate = getScheduleDateForOrder(order, deliverySchedules);
        if (!scheduleDate) {
          return;
        }
        
        const normalizedDate = startOfDay(scheduleDate);
        const dateTimestamp = normalizedDate.getTime();
        const todayTimestamp = today.getTime();
        
        // Count for each filter type
        if (dateTimestamp === todayTimestamp) {
          stats.today++;
          stats.due_today++;
        } else if (dateTimestamp === tomorrow.getTime()) {
          stats.tomorrow++;
        } else if (dateTimestamp >= dayAfterTomorrow.getTime()) {
          stats.future++;
          stats.upcoming++;
        } else if (dateTimestamp < todayTimestamp) {
          stats.past_due++;
        }
        
        // Week-based counts
        if (dateRanges.this_week && isDateInRange(scheduleDate, dateRanges.this_week.start, dateRanges.this_week.end)) {
          stats.this_week++;
        }
        
        if (dateRanges.next_week && isDateInRange(scheduleDate, dateRanges.next_week.start, dateRanges.next_week.end)) {
          stats.next_week++;
        }
      } catch (orderError) {
        console.warn('Error processing order stats:', order?.id, orderError);
      }
    });
  } catch (error) {
    console.error('Error calculating filter stats:', error);
  }
  
  return stats;
};