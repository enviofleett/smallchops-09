import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DetailedOrderData {
  order: any;
  items: any[];
  delivery_schedule?: any;
}

export const useDetailedOrderData = (orderId: string) => {
  return useQuery({
    queryKey: ['detailed-order', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      try {
        // First try the RPC function
        const { data, error } = await supabase.rpc('get_detailed_order_with_products', {
          p_order_id: orderId
        });

        if (error) {
          console.error('RPC error:', error);
          throw error;
        }
        
        if (data && typeof data === 'object' && 'error' in data) {
          console.error('RPC returned error:', data.error);
          throw new Error(data.error as string);
        }

        if (data) {
          return data as unknown as DetailedOrderData;
        }
      } catch (rpcError) {
        console.warn('RPC failed, trying fallback query:', rpcError);
        
        // Fallback: Direct query with joins
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              *,
              products (
                id,
                name,
                description,
                price,
                images,
                category_id,
                is_available
              )
            ),
            delivery_schedule:delivery_schedules (*)
          `)
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error('Fallback query error:', orderError);
          throw orderError;
        }

        if (!orderData) {
          throw new Error('No data returned from fallback query');
        }

        // Transform to expected format
        return {
          order: orderData,
          items: orderData.order_items || [],
          delivery_schedule: orderData.delivery_schedule?.[0] || null
        } as DetailedOrderData;
      }

      throw new Error('No data returned from server');
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1, // Allow one retry for fallback
    gcTime: 1000 * 60 * 10 // Keep data in cache for 10 minutes
  });
};