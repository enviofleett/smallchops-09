import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealTimeOrderUpdates } from './useRealTimeOrderUpdates';
import type { OrderStatus } from '@/types/orders';

type OrderType = 'delivery' | 'pickup' | 'dine_in';

interface UseRealTimeOrderListOptions {
  filters?: {
    status?: OrderStatus[];
    order_type?: OrderType[];
    date_range?: {
      start: string;
      end: string;
    };
  };
  limit?: number;
  enableAutoRefresh?: boolean;
}

/**
 * Hook for real-time order list with live updates
 * Automatically refreshes when orders change
 */
export const useRealTimeOrderList = (options: UseRealTimeOrderListOptions = {}) => {
  const { filters, limit = 50, enableAutoRefresh = true } = options;
  const queryClient = useQueryClient();
  
  // Query for initial data and manual refreshes
  const {
    data: orders,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['orders-list', filters, limit],
    queryFn: async () => {
      console.log('🔍 Fetching orders with filters:', filters);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product:products (
              id,
              name,
              price,
              image_url
            )
          ),
          order_delivery_schedule (
            *
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      
      if (filters?.order_type && filters.order_type.length > 0) {
        query = query.in('order_type', filters.order_type);
      }
      
      if (filters?.date_range) {
        query = query
          .gte('created_at', filters.date_range.start)
          .lte('created_at', filters.date_range.end);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error fetching orders:', error);
        throw error;
      }
      
      console.log(`✅ Fetched ${data?.length || 0} orders`);
      return data || [];
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true
  });

  // Real-time update handlers
  const handleOrderUpdate = useCallback((payload: any) => {
    console.log('🔄 Handling order update in list:', payload);
    
    // Optimistically update the query cache
    queryClient.setQueryData(['orders-list', filters, limit], (oldData: any[]) => {
      if (!oldData) return oldData;
      
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT': {
          // Add new order to the beginning of the list
          const newOrder = { ...newRecord, order_items: [], order_delivery_schedule: null };
          return [newOrder, ...oldData].slice(0, limit);
        }
        
        case 'UPDATE': {
          // Update existing order
          return oldData.map(order => 
            order.id === newRecord.id 
              ? { ...order, ...newRecord }
              : order
          );
        }
        
        case 'DELETE': {
          // Remove deleted order
          return oldData.filter(order => order.id !== oldRecord.id);
        }
        
        default:
          return oldData;
      }
    });
    
    // Refetch to ensure data consistency
    if (enableAutoRefresh) {
      setTimeout(() => {
        refetch();
      }, 1000);
    }
  }, [queryClient, filters, limit, enableAutoRefresh, refetch]);

  const handleDeliveryScheduleUpdate = useCallback((payload: any) => {
    console.log('🚚 Handling delivery schedule update in list:', payload);
    
    // Update orders that have this delivery schedule
    queryClient.setQueryData(['orders-list', filters, limit], (oldData: any[]) => {
      if (!oldData) return oldData;
      
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const orderId = newRecord?.order_id || oldRecord?.order_id;
      
      return oldData.map(order => {
        if (order.id !== orderId) return order;
        
        switch (eventType) {
          case 'INSERT':
          case 'UPDATE':
            return {
              ...order,
              order_delivery_schedule: newRecord
            };
          case 'DELETE':
            return {
              ...order,
              order_delivery_schedule: null
            };
          default:
            return order;
        }
      });
    });
  }, [queryClient, filters, limit]);

  const handleOrderItemUpdate = useCallback((payload: any) => {
    console.log('🛍️ Handling order item update in list:', payload);
    
    // Refetch the full order data when items change
    if (enableAutoRefresh) {
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [enableAutoRefresh, refetch]);

  // Set up real-time subscriptions
  const { connectionStatus, lastUpdate, isConnected } = useRealTimeOrderUpdates({
    onOrderUpdate: handleOrderUpdate,
    onDeliveryScheduleUpdate: handleDeliveryScheduleUpdate,
    onOrderItemUpdate: handleOrderItemUpdate,
    enableNotifications: false // Keep notifications off for list view
  });

  return {
    orders: orders || [],
    isLoading,
    error,
    refetch,
    connectionStatus,
    lastUpdate,
    isConnected,
    // Helper methods
    getOrderById: (id: string) => orders?.find(order => order.id === id),
    getTotalOrders: () => orders?.length || 0
  };
};