
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';

// We define a more specific type for an order that includes its line items.
export type OrderWithItems = Tables<'orders'> & {
  order_items: Tables<'order_items'>[];
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
      .from('orders')
      .select(`*, 
        order_items (*),
        delivery_zones (id, name, description)
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

    if (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      throw new Error(fallbackError.message);
    }

    return { orders: fallbackData || [], count: count || 0 };
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
        delivery_zones (id, name, description)
      `)
      .maybeSingle();

    if (fallbackError) {
      console.error('Fallback update also failed:', fallbackError);
      throw new Error(fallbackError.message);
    }

    return data;
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
