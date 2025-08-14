import { supabase } from '@/integrations/supabase/client';

export interface StatusUpdateData {
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled';
  notes?: string;
  updated_by?: string;
}

export const updateOrderStatus = async (orderId: string, statusData: StatusUpdateData) => {
  // Start transaction-like operation
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('status, order_number, customer_email, customer_name')
    .eq('id', orderId)
    .single();

  if (fetchError) throw fetchError;

  // Update order status
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: statusData.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Log the status change for audit
  await supabase
    .from('audit_logs')
    .insert({
      action: 'order_status_updated',
      category: 'Order Management',
      message: `Order ${currentOrder.order_number} status changed from ${currentOrder.status} to ${statusData.status}`,
      entity_id: orderId,
      old_values: { status: currentOrder.status },
      new_values: { status: statusData.status, notes: statusData.notes },
      created_at: new Date().toISOString()
    });

  return data;
};

export const bulkUpdateOrderStatus = async (orderIds: string[], statusData: StatusUpdateData) => {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: statusData.status,
      updated_at: new Date().toISOString()
    })
    .in('id', orderIds)
    .select();

  if (error) throw error;

  // Log bulk update
  await supabase
    .from('audit_logs')
    .insert({
      action: 'bulk_order_status_update',
      category: 'Order Management',
      message: `Bulk status update: ${orderIds.length} orders updated to ${statusData.status}`,
      new_values: { 
        order_count: orderIds.length, 
        status: statusData.status,
        order_ids: orderIds 
      },
      created_at: new Date().toISOString()
    });

  return data;
};

export const getOrderStatusHistory = async (orderId: string) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', orderId)
    .eq('action', 'order_status_updated')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};