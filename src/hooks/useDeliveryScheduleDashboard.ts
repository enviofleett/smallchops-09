import { useQuery } from '@tanstack/react-query';
import { getOrdersWithDeliverySchedule } from '@/api/deliveryScheduleApi';
import { format, addDays, subDays } from 'date-fns';

interface DashboardFilters {
  dateRange: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'past_week' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  status: string[];
  timeSlot?: 'morning' | 'afternoon' | 'evening';
}

export const useDeliveryScheduleDashboard = (filters: DashboardFilters) => {
  const getDateRange = () => {
    const today = new Date();
    
    switch (filters.dateRange) {
      case 'today':
        return {
          startDate: format(today, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
      case 'tomorrow':
        const tomorrow = addDays(today, 1);
        return {
          startDate: format(tomorrow, 'yyyy-MM-dd'),
          endDate: format(tomorrow, 'yyyy-MM-dd')
        };
      case 'this_week':
        const startOfWeek = subDays(today, today.getDay());
        const endOfWeek = addDays(startOfWeek, 6);
        return {
          startDate: format(startOfWeek, 'yyyy-MM-dd'),
          endDate: format(endOfWeek, 'yyyy-MM-dd')
        };
      case 'next_week':
        const nextWeekStart = addDays(today, 7 - today.getDay());
        const nextWeekEnd = addDays(nextWeekStart, 6);
        return {
          startDate: format(nextWeekStart, 'yyyy-MM-dd'),
          endDate: format(nextWeekEnd, 'yyyy-MM-dd')
        };
      case 'past_week':
        const pastWeekEnd = subDays(today, 1);
        const pastWeekStart = subDays(pastWeekEnd, 6);
        return {
          startDate: format(pastWeekStart, 'yyyy-MM-dd'),
          endDate: format(pastWeekEnd, 'yyyy-MM-dd')
        };
      case 'custom':
        return {
          startDate: filters.customStartDate,
          endDate: filters.customEndDate
        };
      default:
        return {
          startDate: format(today, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
    }
  };

  const { startDate, endDate } = getDateRange();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['delivery-schedule-dashboard', filters],
    queryFn: () => getOrdersWithDeliverySchedule({
      startDate,
      endDate,
      // Remove status filtering since we only want "ready" orders
      pageSize: 100
    }),
    refetchInterval: 30000,
    enabled: !!(startDate && endDate)
  });

  // Filter by time slot if specified
  const filteredOrders = data?.orders?.filter(order => {
    if (!filters.timeSlot || !order.delivery_schedule) return true;
    
    const startHour = parseInt(order.delivery_schedule.delivery_time_start.split(':')[0]);
    
    switch (filters.timeSlot) {
      case 'morning':
        return startHour >= 6 && startHour < 12;
      case 'afternoon':
        return startHour >= 12 && startHour < 18;
      case 'evening':
        return startHour >= 18 && startHour < 24;
      default:
        return true;
    }
  }) || [];

  // Calculate dashboard metrics - all orders are "ready" status
  const metrics = {
    totalOrders: filteredOrders.length,
    readyOrders: filteredOrders.length, // All orders are ready
    assignedOrders: filteredOrders.filter(o => o.assigned_rider_id).length,
    unassignedOrders: filteredOrders.filter(o => !o.assigned_rider_id).length,
    urgentOrders: filteredOrders.filter(order => {
      if (!order.delivery_schedule) return false;
      const deliveryTime = new Date(`${order.delivery_schedule.delivery_date} ${order.delivery_schedule.delivery_time_start}`);
      const now = new Date();
      const timeDiff = deliveryTime.getTime() - now.getTime();
      return timeDiff > 0 && timeDiff <= 2 * 60 * 60 * 1000; // Next 2 hours
    }).length,
    totalRevenue: filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
  };

  return {
    orders: filteredOrders,
    metrics,
    isLoading,
    error,
    refetch,
    total: data?.total || 0
  };
};