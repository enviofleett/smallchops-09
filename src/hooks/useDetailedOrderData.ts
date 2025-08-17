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
      const { data, error } = await supabase.rpc('get_detailed_order_with_products', {
        p_order_id: orderId
      });

      if (error) throw error;
      
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(data.error as string);
      }

      return data as unknown as DetailedOrderData;
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });
};