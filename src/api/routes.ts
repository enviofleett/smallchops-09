
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryRoute {
  id: string;
  driver_id?: string;
  route_date: string;
  total_orders: number;
  total_distance?: number;
  estimated_duration?: number;
  actual_duration?: number;
  route_points?: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RouteOrderAssignment {
  id: string;
  route_id: string;
  order_id: string;
  sequence_number: number;
  estimated_arrival?: string;
  actual_arrival?: string;
  delivery_status: 'pending' | 'en_route' | 'delivered' | 'failed';
  delivery_notes?: string;
  created_at: string;
}

export const getRoutes = async (selectedDate?: string): Promise<DeliveryRoute[]> => {
  let query = (supabase as any)
    .from('delivery_routes')
    .select('*')
    .order('created_at', { ascending: false });

  if (selectedDate) {
    query = query.eq('route_date', selectedDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createRoute = async (routeData: Omit<DeliveryRoute, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryRoute> => {
  const { data, error } = await (supabase as any)
    .from('delivery_routes')
    .insert(routeData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateRoute = async (id: string, updates: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
  const { data, error } = await (supabase as any)
    .from('delivery_routes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const assignOrdersToRoute = async (routeId: string, orderIds: string[]): Promise<RouteOrderAssignment[]> => {
  const assignments = orderIds.map((orderId, index) => ({
    route_id: routeId,
    order_id: orderId,
    sequence_number: index + 1,
    delivery_status: 'pending' as const
  }));

  const { data, error } = await (supabase as any)
    .from('route_order_assignments')
    .insert(assignments)
    .select();

  if (error) throw error;
  // Type cast to handle the string -> union type conversion
  return (data || []).map((item: any) => ({
    ...item,
    delivery_status: item.delivery_status as 'pending' | 'en_route' | 'delivered' | 'failed'
  }));
};

export const getRouteAssignments = async (routeId: string): Promise<RouteOrderAssignment[]> => {
  const { data, error } = await (supabase as any)
    .from('route_order_assignments')
    .select('*')
    .eq('route_id', routeId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  // Type cast to handle the string -> union type conversion
  return (data || []).map((item: any) => ({
    ...item,
    delivery_status: item.delivery_status as 'pending' | 'en_route' | 'delivered' | 'failed'
  }));
};

export const updateDeliveryStatus = async (
  assignmentId: string,
  status: 'pending' | 'en_route' | 'delivered' | 'failed',
  notes?: string
): Promise<void> => {
  const updates: any = { delivery_status: status };
  if (notes) updates.delivery_notes = notes;
  if (status === 'delivered') updates.actual_arrival = new Date().toISOString();

  const { error } = await (supabase as any)
    .from('route_order_assignments')
    .update(updates)
    .eq('id', assignmentId);

  if (error) throw error;
};
