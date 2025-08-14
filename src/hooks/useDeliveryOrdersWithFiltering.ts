import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { getOrdersWithDeliverySchedule } from '@/api/deliveryScheduleApi';
import { OrderStatus } from '@/types/orders';
import { addDays, subDays } from 'date-fns';

interface DeliveryFilters {
  dateRange: 'all' | 'today' | 'tomorrow' | 'this_week' | 'past_week';
  timeSlot: 'all' | 'morning' | 'afternoon' | 'evening';
  urgency: 'all' | 'urgent' | 'due_today' | 'upcoming';
  status: 'all' | OrderStatus;
  searchQuery: string;
  page: number;
  pageSize: number;
}

export const useDeliveryOrdersWithFiltering = (filters: DeliveryFilters) => {
  const useDeliveryFiltering = 
    filters.dateRange !== 'all' || 
    filters.timeSlot !== 'all' || 
    filters.urgency !== 'all';

  const getFilterDates = () => {
    const today = new Date();
    
    switch (filters.dateRange) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      case 'tomorrow':
        const tomorrow = addDays(today, 1);
        return {
          startDate: tomorrow.toISOString().split('T')[0],
          endDate: tomorrow.toISOString().split('T')[0]
        };
      case 'this_week':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: addDays(today, 7).toISOString().split('T')[0]
        };
      case 'past_week':
        return {
          startDate: subDays(today, 7).toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  };

  return useQuery({
    queryKey: [
      'delivery-orders-filtered',
      filters.dateRange,
      filters.timeSlot,
      filters.urgency,
      filters.status,
      filters.searchQuery,
      filters.page,
      filters.pageSize
    ],
    queryFn: async () => {
      if (useDeliveryFiltering) {
        const { startDate, endDate } = getFilterDates();
        
        const result = await getOrdersWithDeliverySchedule({
          startDate,
          endDate,
          status: filters.status === 'all' ? undefined : [filters.status],
          searchQuery: filters.searchQuery || undefined,
          timeSlot: filters.timeSlot === 'all' ? undefined : filters.timeSlot,
          urgency: filters.urgency === 'all' ? undefined : filters.urgency,
          page: filters.page,
          pageSize: filters.pageSize
        });

        // Transform to match expected format
        return {
          orders: result.orders.map((order: any) => ({
            ...order,
            order_items: order.order_items || [],
            order_type: 'delivery',
            delivery_schedule: order.delivery_schedule
          })),
          count: result.total,
          hasDeliverySchedule: true
        };
      } else {
        const result = await getOrders({
          page: filters.page,
          pageSize: filters.pageSize,
          status: filters.status === 'all' ? undefined : filters.status,
          searchQuery: filters.searchQuery || undefined
        });

        return {
          orders: result.orders,
          count: result.count,
          hasDeliverySchedule: false
        };
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  });
};

// Helper function to calculate order metrics
export const calculateOrderMetrics = (orders: any[]) => {
  const now = new Date();
  
  return {
    total: orders.length,
    urgent: orders.filter(order => {
      if (!order.delivery_schedule) return false;
      const deliveryDate = new Date(order.delivery_schedule.delivery_date);
      const [startHours, startMinutes] = order.delivery_schedule.delivery_time_start.split(':').map(Number);
      deliveryDate.setHours(startHours, startMinutes, 0, 0);
      const hoursUntilDelivery = (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilDelivery <= 2 && hoursUntilDelivery > 0;
    }).length,
    dueToday: orders.filter(order => {
      if (!order.delivery_schedule) return false;
      const deliveryDate = new Date(order.delivery_schedule.delivery_date);
      return deliveryDate.toDateString() === now.toDateString();
    }).length,
    upcoming: orders.filter(order => {
      if (!order.delivery_schedule) return false;
      const deliveryDate = new Date(order.delivery_schedule.delivery_date);
      const [startHours, startMinutes] = order.delivery_schedule.delivery_time_start.split(':').map(Number);
      deliveryDate.setHours(startHours, startMinutes, 0, 0);
      const hoursUntilDelivery = (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilDelivery > 2;
    }).length
  };
};