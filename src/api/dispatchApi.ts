import { supabase } from '@/integrations/supabase/client';

export interface DispatchDriver {
  id: string;
  profile_id?: string;
  name: string;
  phone: string;
  email?: string;
  license_number?: string;
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'van';
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
  is_active: boolean;
  current_location?: any;
  created_at: string;
  updated_at: string;
}

export interface NewDispatchDriver {
  name: string;
  phone: string;
  email: string; // Required for dispatch riders
  license_number?: string;
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'van';
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
  is_active?: boolean;
}

export interface OrderAssignment {
  id: string;
  order_id: string;
  rider_id: string;
  assigned_by: string;
  assigned_at: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  status: 'assigned' | 'accepted' | 'en_route' | 'delivered' | 'cancelled';
  notes?: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
}

export interface DispatchAnalytics {
  id: string;
  rider_id: string;
  date: string;
  total_assignments: number;
  completed_assignments: number;
  cancelled_assignments: number;
  average_completion_time_minutes?: number;
  total_distance_km: number;
  customer_rating?: number;
  earnings: number;
  fuel_cost: number;
}

// Enhanced driver creation with profile integration
export const createDispatchDriver = async (
  driverData: NewDispatchDriver, 
  sendInvitation: boolean = true
): Promise<{ driverId: string; invitationSent: boolean }> => {
  console.log('🚀 Creating dispatch driver:', driverData.name, 'with invitation:', sendInvitation);
  
  const { data, error } = await supabase.functions.invoke('dispatch-driver-invitation', {
    body: { 
      driverData,
      sendInvitation 
    }
  });

  if (error) {
    console.error('❌ Failed to create dispatch driver:', error);
    throw new Error(error.message || 'Failed to create dispatch driver');
  }

  console.log('✅ Dispatch driver created successfully:', data);
  return {
    driverId: data.driverId,
    invitationSent: data.invitationSent
  };
};

// Get all active dispatch riders
export const getActiveDispatchRiders = async (): Promise<DispatchDriver[]> => {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('❌ Failed to fetch dispatch riders:', error);
    throw error;
  }
  
  return (data || []) as DispatchDriver[];
};

// Assign rider to order
export const assignRiderToOrder = async (
  orderId: string, 
  riderId: string
): Promise<string> => {
  console.log('🎯 Assigning rider', riderId, 'to order', orderId);
  
  const { data, error } = await supabase.rpc('assign_rider_to_order', {
    p_order_id: orderId,
    p_rider_id: riderId
  });

  if (error) {
    console.error('❌ Failed to assign rider to order:', error);
    throw new Error(error.message || 'Failed to assign rider to order');
  }

  console.log('✅ Rider assigned successfully. Assignment ID:', data);
  
  // Trigger assignment notification email
  try {
    await triggerAssignmentEmail(orderId, riderId);
  } catch (emailError) {
    console.warn('⚠️ Assignment email failed but assignment succeeded:', emailError);
  }
  
  return data;
};

// Trigger assignment notification email
export const triggerAssignmentEmail = async (
  orderId: string, 
  riderId: string
): Promise<void> => {
  console.log('📧 Triggering assignment email for order:', orderId, 'rider:', riderId);
  
  const { error } = await supabase.functions.invoke('rider-assignment-notification', {
    body: { 
      orderId,
      riderId 
    }
  });

  if (error) {
    console.error('📧 Assignment email failed:', error);
    throw error;
  }
  
  console.log('✅ Assignment email triggered successfully');
};

// Get order assignments for a specific order
export const getOrderAssignments = async (orderId: string): Promise<OrderAssignment[]> => {
  const { data, error } = await supabase
    .from('order_assignments')
    .select('*')
    .eq('order_id', orderId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch order assignments:', error);
    throw error;
  }
  
  return (data || []) as OrderAssignment[];
};

// Get assignments for a specific rider
export const getRiderAssignments = async (
  riderId: string, 
  status?: string
): Promise<OrderAssignment[]> => {
  let query = supabase
    .from('order_assignments')
    .select('*')
    .eq('rider_id', riderId);
    
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query.order('assigned_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch rider assignments:', error);
    throw error;
  }
  
  return (data || []) as OrderAssignment[];
};

// Update assignment status
export const updateAssignmentStatus = async (
  assignmentId: string,
  status: 'assigned' | 'accepted' | 'en_route' | 'delivered' | 'cancelled',
  notes?: string
): Promise<void> => {
  const updateData: any = { 
    status,
    updated_at: new Date().toISOString()
  };
  
  if (notes) {
    updateData.notes = notes;
  }
  
  // Add timestamp for status-specific fields
  if (status === 'accepted') {
    updateData.accepted_at = new Date().toISOString();
  } else if (status === 'delivered') {
    updateData.completed_at = new Date().toISOString();
    updateData.actual_delivery_time = new Date().toISOString();
  } else if (status === 'cancelled') {
    updateData.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('order_assignments')
    .update(updateData)
    .eq('id', assignmentId);

  if (error) {
    console.error('❌ Failed to update assignment status:', error);
    throw error;
  }
  
  console.log('✅ Assignment status updated to:', status);
};

// Get dispatch analytics for a rider
export const getDispatchAnalytics = async (
  riderId: string,
  startDate?: string,
  endDate?: string
): Promise<DispatchAnalytics[]> => {
  let query = supabase
    .from('dispatch_analytics')
    .select('*')
    .eq('rider_id', riderId);
    
  if (startDate) {
    query = query.gte('date', startDate);
  }
  
  if (endDate) {
    query = query.lte('date', endDate);
  }
  
  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch dispatch analytics:', error);
    throw error;
  }
  
  return (data || []) as DispatchAnalytics[];
};

// Get all dispatch analytics (admin only)
export const getAllDispatchAnalytics = async (
  startDate?: string,
  endDate?: string
): Promise<DispatchAnalytics[]> => {
  let query = supabase.from('dispatch_analytics').select('*');
    
  if (startDate) {
    query = query.gte('date', startDate);
  }
  
  if (endDate) {
    query = query.lte('date', endDate);
  }
  
  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch all dispatch analytics:', error);
    throw error;
  }
  
  return (data || []) as DispatchAnalytics[];
};