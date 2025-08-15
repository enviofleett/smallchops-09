import { supabase } from '@/integrations/supabase/client';

export interface OrderAssignment {
  id: string;
  order_id: string;
  rider_id: string;
  assigned_by: string;
  assigned_at: string;
  status: string;
  notes?: string;
  accepted_at?: string;
  actual_delivery_time?: string;
  cancelled_at?: string;
  completed_at?: string;
  estimated_delivery_time?: string;
}

export const assignRiderToOrder = async (orderId: string, riderId: string): Promise<OrderAssignment> => {
  // First check if user is admin
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error('Authentication required');
  }

  // Try using the database function first (if available)
  try {
    const { data, error } = await supabase.rpc('assign_rider_to_order', {
      p_order_id: orderId,
      p_rider_id: riderId,
      p_assigned_by: user.user.id
    });

    if (error) throw error;
    return data as unknown as OrderAssignment;
  } catch (error) {
    console.warn('Database function not available, using direct assignment:', error);
    
    // Fallback to direct database operations
    const { data: existingAssignment } = await supabase
      .from('order_assignments')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'active')
      .single();

    if (existingAssignment) {
      // Update existing assignment
      const { data, error } = await supabase
        .from('order_assignments')
        .update({
          rider_id: riderId,
          assigned_by: user.user.id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', existingAssignment.id)
        .select()
        .single();

      if (error) throw error;

      // Update the order with assigned rider
      await supabase
        .from('orders')
        .update({ assigned_rider_id: riderId })
        .eq('id', orderId);

      return data as OrderAssignment;
    } else {
      // Create new assignment
      const { data, error } = await supabase
        .from('order_assignments')
        .insert({
          order_id: orderId,
          rider_id: riderId,
          assigned_by: user.user.id,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Update the order with assigned rider
      await supabase
        .from('orders')
        .update({ assigned_rider_id: riderId })
        .eq('id', orderId);

      return data as OrderAssignment;
    }
  }
};

export const unassignRiderFromOrder = async (orderId: string): Promise<void> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    throw new Error('Authentication required');
  }

  // Update assignment status to cancelled
  await supabase
    .from('order_assignments')
    .update({ 
      status: 'cancelled',
      notes: 'Unassigned by admin'
    })
    .eq('order_id', orderId)
    .eq('status', 'active');

  // Remove assigned rider from order
  const { error } = await supabase
    .from('orders')
    .update({ assigned_rider_id: null })
    .eq('id', orderId);

  if (error) throw error;
};

export const getOrderAssignments = async (orderId?: string): Promise<OrderAssignment[]> => {
  let query = supabase
    .from('order_assignments')
    .select(`
      *,
      orders(order_number, customer_name, status),
      drivers(name, phone, vehicle_type)
    `)
    .order('assigned_at', { ascending: false });

  if (orderId) {
    query = query.eq('order_id', orderId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as OrderAssignment[];
};

export const completeOrderAssignment = async (orderId: string): Promise<void> => {
  const { error } = await supabase
    .from('order_assignments')
    .update({ 
      status: 'completed'
    })
    .eq('order_id', orderId)
    .eq('status', 'active');

  if (error) throw error;
};