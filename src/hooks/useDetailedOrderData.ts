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

      if (!data) {
        throw new Error('No data returned from server');
      }

      return data as unknown as DetailedOrderData;
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: false, // Disable automatic retries to prevent excessive calls
    gcTime: 1000 * 60 * 10 // Keep data in cache for 10 minutes
  });
};