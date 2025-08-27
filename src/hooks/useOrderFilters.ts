import { useMemo } from 'react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';

interface UseOrderFiltersProps {
  orders: OrderWithItems[];
  selectedDate?: Date;
  status?: string;
  orderType?: 'delivery' | 'pickup' | 'all';
  paymentStatus?: 'paid' | 'pending' | 'failed' | 'all';
  searchQuery?: string;
}

interface FilteredOrdersResult {
  filteredOrders: OrderWithItems[];
  totalCount: number;
  metrics: {
    totalOrders: number;
    confirmedOrders: number;
    preparingOrders: number;
    readyOrders: number;
    completedOrders: number;
    assignedOrders: number;
  };
}

export const useOrderFilters = ({
  orders,
  selectedDate,
  status = 'all',
  orderType = 'all',
  paymentStatus = 'all',
  searchQuery = '',
}: UseOrderFiltersProps): FilteredOrdersResult => {
  
  const filteredData = useMemo(() => {
    let filtered = [...orders]; // Create immutable copy to prevent mutations

    // Date filtering - ensure proper date comparison
    if (selectedDate) {
      const targetDate = format(selectedDate, 'yyyy-MM-dd');
      filtered = filtered.filter(order => {
        const orderDate = order.order_time 
          ? format(new Date(order.order_time), 'yyyy-MM-dd')
          : format(new Date(order.created_at), 'yyyy-MM-dd');
        return orderDate === targetDate;
      });
    }

    // Status filtering
    if (status !== 'all') {
      filtered = filtered.filter(order => order.status === status);
    }

    // Order type filtering
    if (orderType !== 'all') {
      filtered = filtered.filter(order => order.order_type === orderType);
    }

    // Payment status filtering
    if (paymentStatus !== 'all') {
      filtered = filtered.filter(order => order.payment_status === paymentStatus);
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.order_number?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_email?.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query)
      );
    }

    // Calculate metrics
    const metrics = {
      totalOrders: filtered.length,
      confirmedOrders: filtered.filter(o => o.status === 'confirmed').length,
      preparingOrders: filtered.filter(o => o.status === 'preparing').length,
      readyOrders: filtered.filter(o => o.status === 'ready').length,
      completedOrders: filtered.filter(o => ['delivered', 'completed'].includes(o.status)).length,
      assignedOrders: filtered.filter(o => o.assigned_rider_id).length,
    };

    return {
      filteredOrders: filtered,
      totalCount: filtered.length,
      metrics,
    };
  }, [orders, selectedDate, status, orderType, paymentStatus, searchQuery]);

  return filteredData;
};