import { supabase } from '@/integrations/supabase/client';

export interface CreateDeliverySchedule {
  order_id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  is_flexible?: boolean;
  special_instructions?: string;
}

export interface DeliverySchedule {
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
}

export interface OrderWithDeliverySchedule {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  payment_status: string;
  total_amount: number;
  delivery_address: any;
  order_time: string;
  order_type: string;
  created_at: string;
  order_items: any[];
  delivery_schedule?: DeliverySchedule;
}

export const createDeliverySchedule = async (scheduleData: CreateDeliverySchedule): Promise<DeliverySchedule> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .insert(scheduleData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getDeliveryScheduleByOrderId = async (orderId: string): Promise<DeliverySchedule | null> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getOrdersWithDeliverySchedule = async (filters: {
  startDate?: string;
  endDate?: string;
  status?: string[];
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  timeSlot?: 'morning' | 'afternoon' | 'evening';
  urgency?: 'urgent' | 'due_today' | 'upcoming';
}): Promise<{ orders: OrderWithDeliverySchedule[]; total: number }> => {
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        customizations,
        special_instructions
      ),
      order_delivery_schedule (
        id,
        delivery_date,
        delivery_time_start,
        delivery_time_end,
        requested_at,
        is_flexible,
        special_instructions,
        created_at,
        updated_at
      )
    `)
    .eq('order_type', 'delivery');

  // Date filtering - now works with both scheduled and unscheduled orders
  if (filters.startDate && filters.endDate) {
    // Only filter by delivery schedule dates if date filters are specifically applied
    query = query.or(`order_delivery_schedule.delivery_date.gte.${filters.startDate},order_delivery_schedule.delivery_date.lte.${filters.endDate}`);
  } else if (filters.startDate) {
    query = query.gte('order_delivery_schedule.delivery_date', filters.startDate);
  } else if (filters.endDate) {
    query = query.lte('order_delivery_schedule.delivery_date', filters.endDate);
  }

  // Status filtering
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status as any);
  }

  // Pagination
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  query = query.range(start, end);

  // Order by created date for consistent ordering (supports both scheduled and unscheduled)
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  // Transform data to include delivery_schedule as a direct property
  const transformedData = data?.map(order => ({
    ...order,
    order_items: order.order_items || [],
    delivery_schedule: order.order_delivery_schedule?.[0] ? {
      ...order.order_delivery_schedule[0],
      order_id: order.id
    } : null
  })) || [];

  return {
    orders: transformedData,
    total: count || 0
  };
};

export const updateDeliverySchedule = async (
  id: string, 
  updates: Partial<CreateDeliverySchedule>
): Promise<DeliverySchedule> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteDeliverySchedule = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('order_delivery_schedule')
    .delete()
    .eq('id', id);

  if (error) throw error;
};