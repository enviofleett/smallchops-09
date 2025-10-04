import { OrderWithItems } from '@/api/orders';
import { startOfDay, addDays } from 'date-fns';
import { DeliveryFilterType, DayFilterType, OrderFilterWarning, HourlyOrderCounts } from '@/types/adminOrders';

/**
 * Comprehensive filtering and sorting logic for admin orders
 * Extracted from component for better testability and maintainability
 */

export const extractDeliverySchedules = (orders: OrderWithItems[]): Record<string, any> => {
  const scheduleMap: Record<string, any> = {};
  
  orders.forEach((order: any) => {
    const schedule = order.delivery_schedule || 
                    (order.order_delivery_schedule?.[0]) ||
                    order.order_delivery_schedule;
    if (schedule) {
      scheduleMap[order.id] = schedule;
    }
  });
  
  return scheduleMap;
};

export const validateDeliveryDate = (dateString: string): Date | null => {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

export const parseDeliveryTimeHour = (timeString: string): number | null => {
  const components = timeString.split(':');
  if (components.length < 2) return null;
  
  const hour = parseInt(components[0], 10);
  return isNaN(hour) ? null : hour;
};

export const prioritySortOrders = (
  orders: OrderWithItems[],
  deliverySchedules: Record<string, any>,
  statusFilter: string
): OrderWithItems[] => {
  let ordersCopy = [...orders];
  
  if (statusFilter === 'confirmed') {
    // PRODUCTION FIX: Sort confirmed orders by payment status, then most recent first
    ordersCopy.sort((a, b) => {
      // Priority 1: Paid orders come first
      const aPaid = a.payment_status === 'paid' ? 1 : 0;
      const bPaid = b.payment_status === 'paid' ? 1 : 0;
      if (aPaid !== bPaid) return bPaid - aPaid;
      
      // Priority 2: Most recent orders first (regardless of delivery schedule)
      const aTime = new Date(a.order_time || a.created_at).getTime();
      const bTime = new Date(b.order_time || b.created_at).getTime();
      const timeDiff = bTime - aTime;
      
      if (timeDiff !== 0) return timeDiff;
      
      // Tie-breaker: Only if created at same time, use delivery window (earliest first)
      const scheduleA = deliverySchedules[a.id];
      const scheduleB = deliverySchedules[b.id];
      
      if (scheduleA?.delivery_date && scheduleB?.delivery_date) {
        try {
          const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start || '00:00'}`);
          const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start || '00:00'}`);
          
          if (!isNaN(dateTimeA.getTime()) && !isNaN(dateTimeB.getTime())) {
            return dateTimeA.getTime() - dateTimeB.getTime();
          }
        } catch (error) {
          console.warn('Error sorting by delivery window:', error);
        }
      }
      
      return 0;
    });
    
    // Production-safe logging for debugging
    if (ordersCopy.length > 0) {
      console.log(`[Admin Orders] Sorted ${ordersCopy.length} confirmed orders. First 5:`, 
        ordersCopy.slice(0, 5).map(o => ({
          id: o.id.slice(0, 8),
          order_number: o.order_number,
          payment: o.payment_status,
          type: o.order_type,
          created: o.order_time || o.created_at,
          delivery_date: deliverySchedules[o.id]?.delivery_date || 'N/A'
        }))
      );
    }
  } else {
    // For all other tabs: Sort by most recent first
    ordersCopy.sort((a, b) => {
      return new Date(b.order_time || b.created_at).getTime() - 
             new Date(a.order_time || a.created_at).getTime();
    });
  }
  
  return ordersCopy;
};

export const applyDeliveryDateFilter = (
  orders: OrderWithItems[],
  filter: DeliveryFilterType,
  deliverySchedules: Record<string, any>
): OrderWithItems[] => {
  if (filter === 'all') return orders;
  
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const dayAfterTomorrow = startOfDay(addDays(new Date(), 2));
  
  return orders.filter(order => {
    const schedule = deliverySchedules[order.id];
    if (!schedule?.delivery_date) return false;
    
    const deliveryDate = validateDeliveryDate(schedule.delivery_date);
    if (!deliveryDate) return false;
    
    const normalizedDate = startOfDay(deliveryDate);
    const normalizedTime = normalizedDate.getTime();
    
    switch (filter) {
      case 'today':
        return normalizedTime === today.getTime();
      case 'tomorrow':
        return normalizedTime === tomorrow.getTime();
      case 'future':
        return normalizedTime >= dayAfterTomorrow.getTime();
      case 'due_today':
        return normalizedTime === today.getTime();
      case 'past_due':
        return normalizedTime < today.getTime();
      case 'upcoming':
        return normalizedTime > today.getTime();
      default:
        return true;
    }
  });
};

export const applyHourlyFilter = (
  orders: OrderWithItems[],
  selectedDay: DayFilterType,
  selectedHour: string | null,
  deliverySchedules: Record<string, any>
): OrderWithItems[] => {
  if (!selectedDay && !selectedHour) return orders;
  
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(new Date(), 1));
  
  return orders.filter(order => {
    // Keep non-delivery and unpaid orders visible
    if (order.order_type !== 'delivery' || order.payment_status !== 'paid') {
      return true;
    }
    
    const schedule = deliverySchedules[order.id];
    if (!schedule?.delivery_date) return false;
    
    const deliveryDate = validateDeliveryDate(schedule.delivery_date);
    if (!deliveryDate) return false;
    
    const normalizedDeliveryDate = startOfDay(deliveryDate);
    
    // Filter by selected day
    if (selectedDay) {
      const targetDate = selectedDay === 'today' ? today : tomorrow;
      if (normalizedDeliveryDate.getTime() !== targetDate.getTime()) {
        return false;
      }
    }
    
    // Filter by selected hour
    if (selectedHour && schedule.delivery_time_start) {
      const orderHour = parseDeliveryTimeHour(schedule.delivery_time_start);
      const selectedHourInt = parseDeliveryTimeHour(selectedHour);
      
      if (orderHour === null || selectedHourInt === null || orderHour !== selectedHourInt) {
        return false;
      }
    }
    
    return true;
  });
};

export const calculateHourlyOrderCounts = (
  orders: OrderWithItems[],
  deliverySchedules: Record<string, any>
): HourlyOrderCounts => {
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const counts: HourlyOrderCounts = { today: {}, tomorrow: {} };
  
  // Initialize hourly slots (8 AM to 10 PM)
  for (let hour = 8; hour <= 22; hour++) {
    const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
    counts.today[timeSlot] = 0;
    counts.tomorrow[timeSlot] = 0;
  }
  
  orders.forEach(order => {
    if (order.order_type !== 'delivery' || order.payment_status !== 'paid') return;
    
    const schedule = deliverySchedules[order.id];
    if (!schedule?.delivery_date || !schedule.delivery_time_start) return;
    
    const deliveryDate = validateDeliveryDate(schedule.delivery_date);
    if (!deliveryDate) return;
    
    const normalizedDate = startOfDay(deliveryDate);
    const hour = parseDeliveryTimeHour(schedule.delivery_time_start);
    
    if (hour === null || hour < 8 || hour > 22) return;
    
    const orderHour = `${hour.toString().padStart(2, '0')}:00`;
    
    if (normalizedDate.getTime() === today.getTime()) {
      counts.today[orderHour] = (counts.today[orderHour] || 0) + 1;
    } else if (normalizedDate.getTime() === tomorrow.getTime()) {
      counts.tomorrow[orderHour] = (counts.tomorrow[orderHour] || 0) + 1;
    }
  });
  
  return counts;
};

export const detectOrderWarnings = (
  orders: OrderWithItems[],
  deliverySchedules: Record<string, any>
): OrderFilterWarning[] => {
  const warnings: OrderFilterWarning[] = [];
  
  orders.forEach(order => {
    // Check for missing schedules on delivery orders
    if (order.order_type === 'delivery' && 
        order.status === 'confirmed' && 
        !deliverySchedules[order.id]) {
      warnings.push({
        type: 'missing_schedule',
        orderId: order.id,
        orderNumber: order.order_number || order.id,
        message: `Order ${order.order_number} is missing a delivery schedule`
      });
    }
    
    // Check for invalid dates
    const schedule = deliverySchedules[order.id];
    if (schedule?.delivery_date && !validateDeliveryDate(schedule.delivery_date)) {
      warnings.push({
        type: 'invalid_date',
        orderId: order.id,
        orderNumber: order.order_number || order.id,
        message: `Order ${order.order_number} has an invalid delivery date`
      });
    }
  });
  
  return warnings;
};

export const isOrderExpired = (
  order: OrderWithItems,
  deliverySchedules: Record<string, any>
): boolean => {
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return false;
  }
  
  const schedule = deliverySchedules[order.id];
  if (!schedule?.delivery_date || !schedule?.delivery_time_end) {
    return false;
  }
  
  try {
    const deliveryEndTime = new Date(`${schedule.delivery_date}T${schedule.delivery_time_end}`);
    return !isNaN(deliveryEndTime.getTime()) && deliveryEndTime < new Date();
  } catch {
    return false;
  }
};

export const calculateOrderCounts = (orders: OrderWithItems[], totalCount: number) => {
  // PRODUCTION FIX: Count ALL confirmed orders, not just paid ones
  const confirmedOrders = orders.filter(o => o.status === 'confirmed');
  
  return {
    all: totalCount,
    confirmed: confirmedOrders.length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length
  };
};
