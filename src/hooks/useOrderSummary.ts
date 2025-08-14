import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface OrderSummaryFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OrderWithDetails {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  status: string;
  payment_status: string;
  order_time: string;
  delivery_address?: any;
  special_instructions?: string;
  order_items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products?: {
      name: string;
      image_url?: string;
      description?: string;
    };
  }>;
}

export const useOrderSummary = (filters: OrderSummaryFilters = {}) => {
  const { page = 1, limit = 10, status, search } = filters;

  const query = useQuery({
    queryKey: ['order-summary', page, limit, status, search],
    queryFn: async ({ signal }) => {
      console.log('🔍 Fetching order summary with filters:', { page, limit, status, search });
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('❌ Authentication error:', authError);
          throw new Error('Authentication failed');
        }
        
        if (!user?.email) {
          console.warn('⚠️ No authenticated user found');
          throw new Error('User not authenticated');
        }

        console.log('✅ User authenticated:', user.email);

        // Get recent orders (last 30 days) instead of older orders
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let orderQuery = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            customer_name,
            customer_email,
            total_amount,
            status,
            payment_status,
            order_time,
            delivery_address,
            special_instructions,
            order_items!inner (
              id,
              product_name,
              quantity,
              unit_price,
              total_price,
              products (
                name,
                image_url,
                description
              )
            )
          `, { count: 'exact' })
          .eq('customer_email', user.email)
          .gte('order_time', thirtyDaysAgo.toISOString()) // Recent orders, not old ones
          .order('order_time', { ascending: false });

        // Apply filters
        if (status && status !== 'all') {
          orderQuery = orderQuery.eq('status', status as any);
        }

        if (search) {
          orderQuery = orderQuery.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
        }

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        orderQuery = orderQuery.range(from, to);

        // Add AbortController support
        if (signal?.aborted) {
          throw new Error('Query aborted');
        }

        console.log('📡 Executing order query...');
        const { data, error, count } = await orderQuery;

        if (signal?.aborted) {
          throw new Error('Query aborted');
        }

        if (error) {
          console.error('❌ Order query error:', error);
          throw new Error(`Failed to fetch orders: ${error.message}`);
        }

        console.log('✅ Orders fetched successfully:', { count: data?.length, total: count });

        // Handle missing product references gracefully
        const processedOrders = (data || []).map(order => ({
          ...order,
          order_items: order.order_items?.map(item => ({
            ...item,
            // Fallback for missing product data
            products: item.products || {
              name: item.product_name,
              image_url: null,
              description: null
            }
          })) || []
        }));

        return {
          orders: processedOrders as OrderWithDetails[],
          count: count || 0,
          hasMore: count ? count > page * limit : false,
          totalPages: count ? Math.ceil(count / limit) : 0
        };
      } catch (error) {
        console.error('❌ Critical error in order summary:', error);
        if (error instanceof Error && error.message === 'Query aborted') {
          throw error;
        }
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch orders');
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: true,
    retry: (failureCount, error) => {
      console.log(`🔄 Retry attempt ${failureCount} for order summary:`, error);
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Set up real-time subscription for order updates
  useEffect(() => {
    console.log('📡 Setting up real-time subscription for order summary');
    let channel: any = null;
    let mounted = true;

    const setupSubscription = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user?.email || !mounted) {
          console.warn('⚠️ Cannot setup subscription - no authenticated user');
          return;
        }

        console.log('✅ Setting up real-time channel for user:', user.email);
        
        channel = supabase
          .channel('order-summary-updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'orders',
              filter: `customer_email=eq.${user.email}`
            },
            (payload) => {
              if (mounted) {
                console.log('📦 Real-time order update received:', payload);
                query.refetch();
              }
            }
          )
          .subscribe((status) => {
            console.log('📡 Subscription status:', status);
          });
      } catch (error) {
        console.error('❌ Error setting up real-time subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (channel) {
        console.log('🔌 Cleaning up real-time subscription');
        supabase.removeChannel(channel);
      }
    };
  }, [query.refetch]);

  return {
    orders: query.data?.orders || [],
    totalCount: query.data?.count || 0,
    hasMore: query.data?.hasMore || false,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  };
};