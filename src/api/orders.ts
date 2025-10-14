import { supabase } from '@/integrations/supabase/client';
import { OrderStatus, PaymentStatus } from '@/types/orders';
import { OrderType } from '@/types/orderDetailsModal';
import { Json } from '@/integrations/supabase/types';
import { safeJSONParseArray, safeJSONParse } from '@/utils/jsonValidation';

export interface OrderWithItems {
  id: string;
  order_number: string;
  status: OrderStatus;
  order_type: OrderType;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_status: PaymentStatus | 'completed' | 'partially_refunded';
  total_amount: number;
  created_at: string;
  updated_at: string;
  admin_notes: string;
  amount_kobo: number;
  assigned_rider_id: string;
  created_by: string;
  delivery_status: string;
  delivery_time: string;
  delivery_time_slot_id: string;
  delivery_zone_id: string;
  email: string;
  estimated_delivery_date: string;
  guest_session_id: string;
  idempotency_key: string;
  last_modified_by: string;
  preferred_delivery_time: string;
  processing_lock: boolean;
  processing_officer_id: string;
  processing_officer_name: string;
  subtotal_cost: number;
  updated_by: string;
  user_id: string;
  items?: any[];
  order_items?: any[];
  delivery_address?: any;
  delivery_fee?: number;
  pickup_time?: string;
  pickup_point_id?: string;
  special_instructions?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  paid_at?: string;
  processing_started_at?: string;
  payment_method?: string;
  payment_reference?: string;
  total_vat?: number;
  order_time?: string;
  delivery_schedule?: any;
  customer_id: string;
  paystack_reference?: string;
  reference_updated_at?: string;
  payment_verified_at?: string;
  pickup_ready?: boolean;
  // Add all other possible database fields to prevent type errors
  [key: string]: any;
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

interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

// Enhanced helper function with proper error handling and JSON validation
function normalizeOrderItems(order: any): OrderWithItems {
  try {
    // Extract items from nested query result (order_items array from JOIN)
    const items = order.order_items || order.items || [];
    
    return {
      ...order,
      items: Array.isArray(items) ? items : safeJSONParseArray(items),
      order_items: Array.isArray(items) ? items : safeJSONParseArray(items),
      delivery_address: order.delivery_address 
        ? (typeof order.delivery_address === 'string' 
            ? safeJSONParse(order.delivery_address, {})
            : order.delivery_address)
        : null
    };
  } catch (error) {
    console.error('Error normalizing order items:', {
      orderId: order.id,
      orderNumber: order.order_number,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Return order with safe fallbacks
    return {
      ...order,
      items: [],
      order_items: [],
      delivery_address: null
    };
  }
}

export async function getOrders(params?: GetOrdersParams) {
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        quantity,
        unit_price,
        total_price,
        product_id,
        product_name,
        special_instructions,
        customizations,
        vat_rate,
        vat_amount,
        discount_amount,
        product:products (
          id,
          name,
          description,
          price,
          cost_price,
          image_url,
          category_id,
          features,
          ingredients
        )
      )
    `, { count: 'exact' });

  // Apply filters if params are provided
  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status as OrderStatus);
  }

  if (params?.searchQuery) {
    query = query.or(`customer_name.ilike.%${params.searchQuery}%,customer_email.ilike.%${params.searchQuery}%,order_number.ilike.%${params.searchQuery}%`);
  }

  if (params?.startDate) {
    query = query.gte('created_at', params.startDate);
  }

  if (params?.endDate) {
    query = query.lte('created_at', params.endDate);
  }

  // Apply pagination
  if (params?.page && params?.pageSize) {
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    query = query.range(from, to);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error) throw error;
  
  // Normalize items to ensure they're always arrays
  const normalizedOrders = (data || []).map(normalizeOrderItems);
  
  return { orders: normalizedOrders, count: count || 0 };
}

/**
 * 🔒 SECURE: Update order with authentication and validation
 * Uses admin-orders-manager edge function with built-in security
 */
export async function updateOrder({ orderId, updates }: OrderUpdatePayload) {
  const { 
    requireAdminAccess, 
    validateOrderUpdate, 
    secureAPICall,
    checkClientRateLimit
  } = await import('@/lib/api-security');

  // Client-side rate limit check
  if (!checkClientRateLimit('update-order', 5, 30000)) {
    throw new Error('Rate limit exceeded');
  }

  return secureAPICall({
    operation: 'updateOrder',
    requiresAdmin: true,
    execute: async (auth) => {
      // Validate input
      validateOrderUpdate({ orderId, updates });

      // Call secured edge function with auth headers
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: { action: 'update', orderId, updates }
      });

      if (error) {
        console.error('❌ Edge function invocation error:', error);
        throw new Error(`Edge Function error: ${error.message || JSON.stringify(error)}`);
      }
      if (!data?.success) {
        console.error('❌ Edge function returned error:', data);
        throw new Error(data?.error || data?.message || 'Failed to update order');
      }
      
      return data;
    }
  });
}

export async function deleteOrder(orderId: string) {
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) throw error;
}

export async function bulkDeleteOrders(orderIds: string[]) {
  const { error } = await supabase.from('orders').delete().in('id', orderIds);
  if (error) throw error;
}

/**
 * 🔒 SECURE: Bulk update orders with admin verification
 * NOTE: This directly updates the database - ensure RLS policies are in place
 */
export async function bulkUpdateOrders(orderIds: string[], updates: Record<string, any>) {
  const { 
    requireAdminAccess, 
    validateBulkUpdate,
    secureAPICall,
    checkClientRateLimit
  } = await import('@/lib/api-security');

  // Client-side rate limit check
  if (!checkClientRateLimit('bulk-update-orders', 3, 60000)) {
    throw new Error('Rate limit exceeded');
  }

  return secureAPICall({
    operation: 'bulkUpdateOrders',
    requiresAdmin: true,
    execute: async (auth) => {
      // Validate input
      validateBulkUpdate({ orderIds, updates });

      // Perform bulk update
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .in('id', orderIds);

      if (error) throw error;
      return { updated_count: (data as any[])?.length || 0 };
    }
  });
}

/**
 * 🔒 SECURE: Assign rider to order with admin verification
 */
export async function assignRiderToOrder(orderId: string, riderId: string) {
  const { secureAPICall, requireAdminAccess } = await import('@/lib/api-security');

  return secureAPICall({
    operation: 'assignRiderToOrder',
    requiresAdmin: true,
    execute: async () => {
      // Use secured updateOrder function
      return updateOrder({ 
        orderId, 
        updates: { assigned_rider_id: riderId }
      });
    }
  });
}

// Function overloads for manuallyQueueCommunicationEvent
export async function manuallyQueueCommunicationEvent(orderId: string, eventType: string): Promise<any>;
export async function manuallyQueueCommunicationEvent(order: OrderWithItems, eventType: string): Promise<any>;
export async function manuallyQueueCommunicationEvent(orderOrId: string | OrderWithItems, eventType: string) {
  const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId.id;
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