import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
 * Fallback hook for fetching orders directly from Supabase
 * Used when the edge function is not working
 */
export const useOrdersFallback = (filters: OrderFilters = {}) => {
  return useQuery({
    queryKey: ['orders-fallback', filters],
    queryFn: async () => {
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

      const { data, error, count } = await query;

      if (error) {
        console.error('Fallback order fetch error:', error);
        throw error;
      }

      return {
        orders: data || [],
        total_count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 2
  });
};

/**
 * Smart order fetching hook that tries edge function first, then falls back to direct query
 */
export const useOrdersSmart = (filters: OrderFilters = {}) => {
  // First try the edge function
  const edgeFunctionQuery = useQuery({
    queryKey: ['orders-edge', filters],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

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
        
        return { source: 'edge-function', ...data.data };
      } catch (error) {
        console.warn('Edge function failed, will use fallback:', error);
        throw error;
      }
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 1, // Only retry once before falling back
    retryOnMount: false
  });

  // Fallback query - only runs if edge function fails
  const fallbackQuery = useOrdersFallback(filters);

  // Return the successful query or fallback with better logic
  if (edgeFunctionQuery.data && !edgeFunctionQuery.error) {
    console.log('✅ Using edge function data');
    return {
      ...edgeFunctionQuery,
      data: { ...edgeFunctionQuery.data, source: 'edge-function' }
    };
  } else if (edgeFunctionQuery.error || edgeFunctionQuery.failureCount > 0) {
    console.log('⚠️ Edge function failed, using fallback:', edgeFunctionQuery.error?.message);
    return {
      ...fallbackQuery,
      data: fallbackQuery.data ? { ...fallbackQuery.data, source: 'fallback' } : undefined,
      isLoading: fallbackQuery.isLoading,
      error: fallbackQuery.error
    };
  }

  return edgeFunctionQuery;
};