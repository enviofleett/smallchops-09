import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface UsePaidOrdersProps {
  selectedDate?: Date;
  orderType?: 'delivery' | 'pickup' | 'all';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const usePaidOrders = ({
  selectedDate = new Date(),
  orderType = 'all',
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}: UsePaidOrdersProps = {}) => {
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');

  const { 
    data: ordersData, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useQuery({
    queryKey: ['paid-orders', selectedDateString, orderType, lastRefresh],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 1000,
      startDate: selectedDateString,
      endDate: selectedDateString,
    }),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Filter for paid orders only - create immutable copy
  const paidOrders = (ordersData?.orders || [])
    .filter(order => order.payment_status === 'paid')
    .filter(order => orderType === 'all' || order.order_type === orderType)
    .map(order => ({ ...order })) // Ensure immutability
    .sort((a, b) => {
      // Sort by order time, most recent first
      const timeA = new Date(a.order_time || a.created_at).getTime();
      const timeB = new Date(b.order_time || b.created_at).getTime();
      return timeB - timeA;
    });

  // Manual refresh function
  const refresh = async () => {
    try {
      setLastRefresh(Date.now());
      await refetch();
      toast.success('Orders refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh orders');
    }
  };

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  return {
    orders: paidOrders,
    totalCount: paidOrders.length,
    isLoading,
    error,
    refresh,
    isRefetching,
    rawData: ordersData,
  };
};