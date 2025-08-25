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
        
        // Fallback: Separate queries to avoid foreign key issues
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
            )
          `)
          .eq('id', orderId)
          .maybeSingle();

        if (orderError) {
          console.error('Fallback query error:', orderError);
          throw orderError;
        }

        if (!orderData) {
          throw new Error('No data returned from fallback query');
        }

        // Separate query for delivery schedule
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

        // Transform to expected format
        return {
          order: orderData,
          items: orderData.order_items || [],
          delivery_schedule: deliverySchedule
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