import { supabase } from '@/integrations/supabase/client';

export interface DeliveryRoute {
  id: string;
  driver_id: string;
  route_date: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  total_orders: number;
  total_distance?: number;
  estimated_duration?: number;
  actual_duration?: number;
  route_points?: any;
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

export const getRoutes = async (date?: string): Promise<DeliveryRoute[]> => {
  let query = supabase
    .from('delivery_routes' as any)
    .select(`
      *,
      drivers(name, phone, vehicle_type)
    `)
    .order('route_date', { ascending: false });

  if (date) {
    query = query.eq('route_date', date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as DeliveryRoute[];
};

export const createRoute = async (route: Omit<DeliveryRoute, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryRoute> => {
  const { data, error } = await supabase
    .from('delivery_routes' as any)
    .insert(route)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DeliveryRoute;
};

export const updateRoute = async (id: string, updates: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
  const { data, error } = await supabase
    .from('delivery_routes' as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DeliveryRoute;
};

export const assignOrdersToRoute = async (routeId: string, orderIds: string[]): Promise<RouteOrderAssignment[]> => {
  const assignments = orderIds.map((orderId, index) => ({
    route_id: routeId,
    order_id: orderId,
    sequence_number: index + 1,
    delivery_status: 'pending' as const
  }));

  const { data, error } = await supabase
    .from('route_order_assignments' as any)
    .insert(assignments)
    .select();

  if (error) throw error;

  // Update route total orders count
  await supabase
    .from('delivery_routes' as any)
    .update({ total_orders: orderIds.length })
    .eq('id', routeId);

  return (data || []) as unknown as RouteOrderAssignment[];
};

export const getRouteAssignments = async (routeId: string): Promise<RouteOrderAssignment[]> => {
  const { data, error } = await supabase
    .from('route_order_assignments' as any)
    .select(`
      *,
      orders(
        id,
        order_number,
        customer_name,
        delivery_address,
        total_amount,
        status
      )
    `)
    .eq('route_id', routeId)
    .order('sequence_number');

  if (error) throw error;
  return (data || []) as unknown as RouteOrderAssignment[];
};

export const updateDeliveryStatus = async (
  assignmentId: string, 
  status: 'pending' | 'en_route' | 'delivered' | 'failed',
  notes?: string
): Promise<void> => {
  const updates: any = {
    delivery_status: status,
    delivery_notes: notes
  };

  if (status === 'delivered') {
    updates.actual_arrival = new Date().toISOString();
  }

  const { error } = await supabase
    .from('route_order_assignments' as any)
    .update(updates)
    .eq('id', assignmentId);

  if (error) throw error;
};

export const optimizeRoute = async (routeId: string): Promise<DeliveryRoute> => {
  // This would implement route optimization logic
  // For now, just return the route as-is
  const { data, error } = await supabase
    .from('delivery_routes' as any)
    .select()
    .eq('id', routeId)
    .single();

  if (error) throw error;
  return data as unknown as DeliveryRoute;
};