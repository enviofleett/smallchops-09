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
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user?.email) throw new Error('User not authenticated');

      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
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
          order_items (
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
        `)
        .eq('customer_email', user.email)
        .lt('order_time', thirtyDaysAgo.toISOString()) // Only orders older than 30 days
        .order('order_time', { ascending: false });

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status as any);
      }

      if (search) {
        query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        orders: (data as OrderWithDetails[]) || [],
        count: count || 0,
        hasMore: count ? count > page * limit : false,
        totalPages: count ? Math.ceil(count / limit) : 0
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: true
  });

  // Set up real-time subscription for order updates
  useEffect(() => {
    const user = supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return;

      const channel = supabase
        .channel('order-summary-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `customer_email=eq.${user.email}`
          },
          () => {
            query.refetch();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });

    return () => {
      user.then(cleanup => cleanup?.());
    };
  }, [query]);

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