import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OrderStatus } from '@/types/orders';

interface OrderFilters {
  status?: OrderStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Production-ready order fetching hook with smart fallback
 * Tries edge function first, automatically falls back to direct queries
 */
export const useOrdersProduction = (filters: OrderFilters = {}) => {
  return useQuery({
    queryKey: ['orders-production', filters],
    queryFn: async () => {
      // Try edge function first
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        console.log('🚀 Attempting edge function for orders...');
        const { data, error } = await supabase.functions.invoke('order-manager', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: {
            action: 'list_orders',
            admin_id: session.user.id,
            page: filters.page || 1,
            page_size: filters.pageSize || 20,
            status_filter: filters.status || 'all',
            search_query: filters.search || '',
            start_date: filters.startDate,
            end_date: filters.endDate
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        console.log('✅ Edge function successful');
        return { 
          ...data.data, 
          source: 'edge-function',
          page: filters.page || 1,
          pageSize: filters.pageSize || 20,
          totalPages: Math.ceil((data.data.total_count || 0) / (filters.pageSize || 20))
        };
      } catch (edgeError) {
        console.warn('⚠️ Edge function failed, using direct query fallback:', edgeError.message);
        
        // Fallback to direct Supabase query
        let query = supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              product_id,
              quantity,
              unit_price,
              total_price,
              customizations
            )
          `, { count: 'exact' });

        // Apply filters
        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status as OrderStatus);
        }

        if (filters.search) {
          query = query.or(`order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%`);
        }

        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }

        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }

        // Apply pagination
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        query = query.range(from, to).order('created_at', { ascending: false });

        const { data: fallbackData, error: fallbackError, count } = await query;

        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          throw fallbackError;
        }

        console.log('✅ Fallback query successful');
        return {
          orders: fallbackData || [],
          total_count: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
          source: 'fallback'
        };
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      // Don't retry if it's an authentication error
      if (error.message?.includes('Not authenticated')) {
        return false;
      }
      return failureCount < 2;
    }
  });
};

/**
 * Production-ready order update hook with enhanced error handling
 */
export const useOrderUpdateProduction = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, newStatus, adminId }: { orderId: string; newStatus: string; adminId: string }) => {
      // Use the production-ready database function
      const { data, error } = await supabase.rpc('admin_update_order_status_production', {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_admin_id: adminId
      });

      if (error) throw error;
      
      const result = data as any;
      
      if (!result.success) {
        throw new Error(result.error || 'Update failed');
      }
      
      return result;
    },
    onSuccess: (result, variables) => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ['orders-production'] });
      queryClient.invalidateQueries({ queryKey: ['orders-new'] });
      queryClient.invalidateQueries({ queryKey: ['orders-fallback'] });
      
      toast({
        title: "Order Updated",
        description: `Order status changed to ${variables.newStatus}`,
      });
    },
    onError: (error: Error) => {
      console.error('❌ Order update failed:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};

/**
 * Production-ready real-time updates hook
 */
export const useOrdersRealTimeProduction = () => {
  const queryClient = useQueryClient();

  return {
    subscribe: () => {
      const channel = supabase
        .channel('orders-realtime-production')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            console.log('📡 Real-time order update:', payload.eventType);
            
            // Invalidate all order queries to refetch data
            queryClient.invalidateQueries({ queryKey: ['orders-production'] });
            queryClient.invalidateQueries({ queryKey: ['orders-new'] });
            queryClient.invalidateQueries({ queryKey: ['orders-fallback'] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  };
};