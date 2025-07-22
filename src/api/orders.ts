
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
}

/**
 * Fetches orders and their associated items from the database with pagination and filtering.
 * The results are ordered by the time the order was placed.
 */
export const getOrders = async ({
  page = 1,
  pageSize = 10,
  status = 'all',
  searchQuery = '',
}: GetOrdersParams): Promise<{ orders: OrderWithItems[]; count: number }> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('orders')
    .select('*, order_items (*)', { count: 'exact' });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (searchQuery) {
    const searchString = `%${searchQuery}%`;
    query = query.or(
      `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
    );
  }

  const { data, error, count } = await query
    .order('order_time', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching orders:', error);
    throw new Error(error.message);
  }

  return { orders: data || [], count: count || 0 };
};

export const updateOrder = async (
  orderId: string,
  updates: { status?: OrderStatus; assigned_rider_id?: string | null }
): Promise<OrderWithItems> => {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select('*, order_items (*)')
    .single();

  if (error) {
    console.error('Error updating order:', error);
    throw new Error(error.message);
  }

  return data;
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
