import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderWithDeliveryInfo {
  id: string;
  order_number: string;
  order_type: 'delivery' | 'pickup' | 'dine_in';
  delivery_address?: any;
  pickup_point?: {
    id: string;
    name: string;
    address: string;
    phone?: string;
  };
  delivery_zone?: {
    id: string;
    name: string;
    delivery_fee?: number;
  };
  delivery_schedule?: {
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
    special_instructions?: string;
    is_flexible?: boolean;
  };
  estimated_delivery?: string;
  tracking_reference?: string;
}

export const useOrderDeliveryInfo = (orderId: string) => {
  return useQuery({
    queryKey: ['order-delivery-info', orderId],
    queryFn: async (): Promise<OrderWithDeliveryInfo | null> => {
      // Get basic order info
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_type,
          delivery_address,
          pickup_point_id,
          delivery_zone_id
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        console.error('Error fetching order:', orderError);
        return null;
      }

      let pickup_point = null;
      let delivery_zone = null;
      let delivery_schedule = null;

      // Get pickup point info if applicable
      if (order.pickup_point_id) {
        const { data: pickupData } = await supabase
          .from('pickup_points')
          .select('id, name, address, phone')
          .eq('id', order.pickup_point_id)
          .single();
        
        if (pickupData) {
          pickup_point = pickupData;
        }
      }

      // Get delivery zone info if applicable
      if (order.delivery_zone_id) {
        const { data: zoneData } = await supabase
          .from('delivery_zones')
          .select('id, name, delivery_fee')
          .eq('id', order.delivery_zone_id)
          .single();
        
        if (zoneData) {
          delivery_zone = zoneData;
        }
      }

      // Get delivery schedule info
      const { data: scheduleData } = await supabase
        .from('order_delivery_schedule')
        .select(`
          delivery_date,
          delivery_time_start,
          delivery_time_end,
          special_instructions,
          is_flexible
        `)
        .eq('order_id', orderId)
        .single();

      if (scheduleData) {
        delivery_schedule = scheduleData;
      }

      return {
        id: order.id,
        order_number: order.order_number,
        order_type: order.order_type,
        delivery_address: order.delivery_address,
        pickup_point,
        delivery_zone,
        delivery_schedule
      };
    },
    enabled: !!orderId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};