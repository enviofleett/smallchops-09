
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';

// We define a more specific type for an order that includes its line items and delivery zones.
export type OrderWithItems = Tables<'orders'> & {
  order_items: Tables<'order_items'>[];
  delivery_zones?: Tables<'delivery_zones'> | null;
  delivery_schedule?: {
    id: string;
    order_id: string;
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
    requested_at: string;
    is_flexible: boolean;
    special_instructions?: string;
    created_at: string;
    updated_at: string;
  } | null;
};

interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | 'all';
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetches orders and their associated items from the database with pagination and filtering.
 * Uses admin edge function to bypass RLS for authenticated admin users.
 */
export const getOrders = async ({
  page = 1,
  pageSize = 10,
  status = 'all',
  searchQuery = '',
  startDate,
  endDate,
}: GetOrdersParams): Promise<{ orders: OrderWithItems[]; count: number }> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'list',
        page,
        pageSize,
        status,
        searchQuery,
        startDate,
        endDate
      }
    });

    if (error) {
      console.error('Error fetching orders via admin function:', error);
      throw new Error(error.message || 'Failed to fetch orders');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch orders');
    }

    return { orders: data.orders || [], count: data.count || 0 };
  } catch (error) {
    console.error('Error fetching orders:', error);
    
    // Fallback to direct Supabase query for backward compatibility
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('orders_view')
      .select(`*, 
        order_items (*),
        order_delivery_schedule (*)
      `, { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (searchQuery) {
      const searchString = `%${searchQuery}%`;
      query = query.or(
        `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
      );
    }

    const { data: fallbackData, error: fallbackError, count } = await query
      .order('order_time', { ascending: false })
      .range(from, to);

    // If query with delivery zones fails, try without them and manually fetch
    if (fallbackError) {
      console.warn('Query with delivery zones failed, trying fallback:', fallbackError.message);
      
      let fallbackQuery = supabase
        .from('orders_view')
        .select(`*, order_items (*), order_delivery_schedule (*)`, { count: 'exact' });

      if (status !== 'all') {
        fallbackQuery = fallbackQuery.eq('status', status);
      }

      if (searchQuery) {
        const searchString = `%${searchQuery}%`;
        fallbackQuery = fallbackQuery.or(
          `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
        );
      }

      const { data: noZoneData, error: noZoneError, count: noZoneCount } = await fallbackQuery
        .order('order_time', { ascending: false })
        .range(from, to);

      if (noZoneError) {
        console.error('Fallback query also failed:', noZoneError);
        throw new Error(noZoneError.message);
      }

      // Manually fetch delivery zones for each order
      const ordersWithZones = await Promise.all(
        (noZoneData || []).map(async (order: any) => {
          if (order.delivery_zone_id) {
            try {
              const { data: zone } = await supabase
                .from('delivery_zones')
                .select('id, name, base_fee, is_active')
                .eq('id', order.delivery_zone_id)
                .single();
              
              return { ...order, delivery_zones: zone };
            } catch (zoneError) {
              console.warn(`Failed to fetch zone for order ${order.id}:`, zoneError);
              return { ...order, delivery_zones: null };
            }
          }
          return { ...order, delivery_zones: null };
        })
      );

      return { orders: ordersWithZones as unknown as OrderWithItems[], count: noZoneCount || 0 };
    }

    return { orders: fallbackData as unknown as OrderWithItems[] || [], count: count || 0 };
  }
};

export const updateOrder = async (
  orderId: string,
  updates: { status?: OrderStatus; assigned_rider_id?: string | null }
): Promise<OrderWithItems> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'update',
        orderId,
        updates
      }
    });

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to update order');
    }

    return data.order;
  } catch (error) {
    console.error('Error updating order via admin function:', error);
    
    // Fallback to direct update
    const { data, error: fallbackError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select(`*, 
        order_items (*),
        delivery_zones (id, name, base_fee, is_active),
        order_delivery_schedule (*)
      `)
      .maybeSingle();

    // If update with delivery zone fails, try without zone and manually fetch
    if (fallbackError) {
      console.warn('Update with delivery zone failed, trying without zone:', fallbackError.message);
      
      const { data: noZoneData, error: noZoneError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select(`*, order_items (*), order_delivery_schedule (*)`)
        .maybeSingle();

      if (noZoneError) {
        console.error('Fallback update also failed:', noZoneError);
        throw new Error(noZoneError.message);
      }

      // Manually fetch delivery zone
      if (noZoneData?.delivery_zone_id) {
        try {
          const { data: zone } = await supabase
            .from('delivery_zones')
            .select('id, name, base_fee, is_active')
            .eq('id', noZoneData.delivery_zone_id)
            .single();
          
           return { ...noZoneData, delivery_zones: zone } as unknown as OrderWithItems;
        } catch (zoneError) {
          console.warn(`Failed to fetch zone for updated order ${orderId}:`, zoneError);
          return { ...noZoneData, delivery_zones: null } as unknown as OrderWithItems;
        }
      } else {
        return { ...noZoneData, delivery_zones: null } as unknown as OrderWithItems;
      }
    }

    return data as unknown as OrderWithItems;
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'delete',
        orderId
      }
    });

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete order');
    }
  } catch (error) {
    console.error('Error deleting order via admin function:', error);
    
    // Fallback to direct delete
    const { error: fallbackError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (fallbackError) {
      console.error('Fallback delete also failed:', fallbackError);
      throw new Error(fallbackError.message);
    }
  }
};

export const bulkDeleteOrders = async (orderIds: string[]): Promise<void> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'bulk_delete',
        orderIds
      }
    });

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete orders');
    }
  } catch (error) {
    console.error('Error bulk deleting orders via admin function:', error);
    
    // Fallback to direct delete
    const { error: fallbackError } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds);

    if (fallbackError) {
      console.error('Fallback bulk delete also failed:', fallbackError);
      throw new Error(fallbackError.message);
    }
  }
};

export const manuallyQueueCommunicationEvent = async (
  order: OrderWithItems,
  status: OrderStatus
): Promise<void> => {
  const { error } = await supabase.from('communication_events').insert({
    order_id: order.id,
    event_type: 'order_status_update', // Re-using to leverage existing processor
    payload: {
      old_status: order.status,
      new_status: status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
    },
  });

  if (error) {
    console.error('Error queueing manual communication event:', error);
    throw new Error(error.message);
  }
};
