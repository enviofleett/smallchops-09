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
  // Always use delivery filtering for production readiness - includes orders with and without schedules
  const useDeliveryFiltering = true;

  const getFilterDates = () => {
    const today = new Date();
    // Set time to start of day to ensure consistent date comparisons
    today.setHours(0, 0, 0, 0);
    
    switch (filters.dateRange) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        return {
          startDate: todayStr,
          endDate: todayStr
        };
      case 'tomorrow':
        const tomorrow = addDays(today, 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        return {
          startDate: tomorrowStr,
          endDate: tomorrowStr
        };
      case 'this_week':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: addDays(today, 6).toISOString().split('T')[0] // 7 days including today
        };
      case 'past_week':
        return {
          startDate: subDays(today, 6).toISOString().split('T')[0], // 7 days including today
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
      try {
        const { startDate, endDate } = getFilterDates();
        
        const result = await getOrdersWithDeliverySchedule({
          startDate,
          endDate,
          status: filters.status === 'all' ? undefined : [filters.status],
          searchQuery: filters.searchQuery?.trim() || undefined,
          timeSlot: filters.timeSlot === 'all' ? undefined : filters.timeSlot,
          urgency: filters.urgency === 'all' ? undefined : filters.urgency,
          page: filters.page,
          pageSize: filters.pageSize
        });

        // Validate response structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response from delivery orders API');
        }
        
        // Transform to match expected format with proper delivery schedule handling
        const transformedOrders = result.orders.map((order: any) => ({
          ...order,
          order_items: order.order_items || [],
          order_type: order.order_type || 'delivery',
          delivery_schedule: order.delivery_schedule || null
        }));

        return {
          orders: transformedOrders,
          count: result.total, // Use the filtered total from API
          hasDeliverySchedule: true,
          // Calculate metrics for the filtered results
          metrics: calculateOrderMetrics(transformedOrders)
        };
      } catch (error) {
        console.error('Failed to fetch delivery orders:', error);
        throw error;
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