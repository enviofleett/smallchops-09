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
          console.warn('RPC error, using fallback query:', error);
          throw error; // This will trigger the fallback
        }
        
        if (data && typeof data === 'object' && 'error' in data) {
          console.warn('RPC returned error, using fallback query:', data.error);
          throw new Error(data.error as string);
        }

        if (data) {
          return data as unknown as DetailedOrderData;
        }
      } catch (rpcError) {
        console.warn('RPC failed, trying fallback query:', rpcError);
        
        // Fallback: Separate queries with better error handling
        try {
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
                  image_url,
                  category_id,
                  features
                )
              )
            `)
            .eq('id', orderId)
            .maybeSingle();

          if (orderError) {
            console.error('Fallback query error:', orderError);
            throw new Error(`Failed to fetch order details: ${orderError.message}`);
          }

          if (!orderData) {
            throw new Error('Order not found');
          }

          // Separate query for delivery schedule (non-critical)
          let deliverySchedule = null;
          try {
            const { data: scheduleData } = await supabase
              .from('order_delivery_schedule')
              .select('*')
              .eq('order_id', orderId)
              .maybeSingle();
            
            deliverySchedule = scheduleData;
          } catch (scheduleError) {
            console.warn('Could not fetch delivery schedule:', scheduleError);
            // Continue without schedule - not critical
          }

          // Transform to expected format with normalized product data
          const normalizedItems = (orderData.order_items || []).map((item: any) => ({
            ...item,
            product: item.products ? {
              ...item.products,
              images: item.products.image_url ? [item.products.image_url] : []
            } : null
          }));

          return {
            order: orderData,
            items: normalizedItems,
            delivery_schedule: deliverySchedule
          } as DetailedOrderData;
        } catch (fallbackError) {
          console.error('Both RPC and fallback queries failed:', fallbackError);
          throw fallbackError;
        }
      }

      throw new Error('No data returned from server');
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors, but not for "not found" errors
      if (failureCount >= 2) return false;
      if (error instanceof Error && error.message.includes('not found')) return false;
      return true;
    },
    gcTime: 1000 * 60 * 10 // Keep data in cache for 10 minutes
  });
};