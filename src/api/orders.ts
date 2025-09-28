import { supabase } from '@/integrations/supabase/client';

export interface OrderWithItems {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items?: any[];
}

export interface OrderUpdatePayload {
  orderId: string;
  updates: {
    status?: string;
    assigned_rider_id?: string;
    customer_phone?: string;
    [key: string]: any;
  };
}

export async function getOrders() {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateOrder({ orderId, updates }: OrderUpdatePayload) {
  const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
    body: { action: 'update', orderId, updates }
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Failed to update order');
  return data;
}

export async function deleteOrder(orderId: string) {
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) throw error;
}

export async function bulkDeleteOrders(orderIds: string[]) {
  const { error } = await supabase.from('orders').delete().in('id', orderIds);
  if (error) throw error;
}

export async function bulkUpdateOrders(orderIds: string[], updates: Record<string, any>) {
  const { data, error } = await supabase.from('orders').update(updates).in('id', orderIds);
  if (error) throw error;
  return { updated_count: data?.length || 0 };
}

export async function assignRiderToOrder(orderId: string, riderId: string) {
  return updateOrder({ orderId, updates: { assigned_rider_id: riderId }});
}

export async function manuallyQueueCommunicationEvent(orderId: string, eventType: string) {
  const { data, error } = await supabase.from('communication_events').insert({
    event_type: eventType,
    order_id: orderId,
    status: 'queued'
  });
  if (error) throw error;
  return data;
}

export async function getDispatchRiders() {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, name, phone, email, vehicle_type, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}