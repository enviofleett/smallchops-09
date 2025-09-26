import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DetailedOrderData {
  order: any;
  items: any[];
  delivery_schedule?: any;
  pickup_point?: any;
  business_settings?: any;
  fulfillment_info?: {
    type: 'pickup' | 'delivery';
    booking_window?: string;
    pickup_time?: string;
    delivery_date?: string;
    delivery_hours?: {
      start: string;
      end: string;
      is_flexible: boolean;
    };
    address?: string;
    special_instructions?: string;
    delivery_instructions?: string;
    order_instructions?: string;
    schedule_instructions?: string;
    requested_at?: string;
    business_hours?: any;
    pickup_point_name?: string;
    pickup_point_phone?: string;
    pickup_point_hours?: any;
  };
}

export const useDetailedOrderData = (orderId: string) => {
  return useQuery({
    queryKey: ['detailed-order', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      
      // Optimized primary query - use comprehensive RPC first
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      
      if (isUUID) {
        // Use comprehensive RPC for UUIDs (most efficient)
        const { data: comprehensiveData, error: comprehensiveError } = await supabase
          .rpc('get_comprehensive_order_fulfillment', { p_order_id: orderId });
        
        if (!comprehensiveError && comprehensiveData && !(comprehensiveData as any)?.error) {
          return (comprehensiveData as unknown) as DetailedOrderData;
        }
        console.warn('Comprehensive RPC failed, using fallback:', comprehensiveError);
      }
      
      // Fallback for order numbers or when RPC fails
      const orderQuery = isUUID 
        ? supabase.from('orders').select('*').eq('id', orderId)
        : supabase.from('orders').select('*').eq('order_number', orderId);
      
      const [orderResult, scheduleResult] = await Promise.all([
        orderQuery.maybeSingle(),
        supabase.from('order_delivery_schedule').select('*').eq(
          isUUID ? 'order_id' : 'order_id', orderId
        ).maybeSingle()
      ]);
      
      if (orderResult.error) throw orderResult.error;
      if (!orderResult.data) throw new Error('Order not found');
      
      const order = orderResult.data;
      const schedule = scheduleResult.data;
      
      return {
        order,
        delivery_schedule: schedule,
        items: [],
        fulfillment_info: {
          type: order.order_type,
          address: (order.delivery_address as any)?.address_line_1 || 
                  (order.delivery_address as any)?.address || 
                  'Address not available',
          delivery_date: schedule?.delivery_date,
          delivery_hours: schedule ? {
            start: schedule.delivery_time_start,
            end: schedule.delivery_time_end,
            is_flexible: schedule.is_flexible || false
          } : null,
          special_instructions: schedule?.special_instructions || order.special_instructions || 'No special instructions',
          requested_at: schedule?.requested_at
        }
      } as DetailedOrderData;
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