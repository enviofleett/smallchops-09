import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderUpdateRequest {
  action: 'update_status' | 'assign_rider' | 'add_notes' | 'list_orders';
  order_id?: string;
  new_status?: string;
  rider_id?: string;
  rider_name?: string;
  notes?: string;
  admin_id: string;
  admin_name?: string;
  version?: number;
  // List parameters
  page?: number;
  page_size?: number;
  status_filter?: string;
  search_query?: string;
}

interface OrderUpdateResponse {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  conflict?: {
    current_version: number;
    current_status: string;
    last_updated_by: string;
    last_updated_at: string;
  };
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    // Parse request body
    const body: OrderUpdateRequest = await req.json();
    
    // Validate admin permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new Error('Admin access required');
    }

    // Route to appropriate handler
    let result: OrderUpdateResponse;
    
    switch (body.action) {
      case 'list_orders':
        result = await listOrders(body);
        break;
      case 'update_status':
        result = await updateOrderStatus(body);
        break;
      case 'assign_rider':
        result = await assignRider(body);
        break;
      case 'add_notes':
        result = await addNotes(body);
        break;
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Order manager error:', error);
    
    const errorResponse: OrderUpdateResponse = {
      success: false,
      error: error.message,
      code: getErrorCode(error.message)
    };

    const status = getErrorStatus(error.message);

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function listOrders(request: OrderUpdateRequest): Promise<OrderUpdateResponse> {
  const page = request.page || 1;
  const pageSize = request.page_size || 20;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('orders_new')
    .select(`
      *,
      order_items_new(*),
      order_delivery_schedule(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Apply filters
  if (request.status_filter && request.status_filter !== 'all') {
    query = query.eq('status', request.status_filter);
  }

  if (request.search_query) {
    query = query.or(`order_number.ilike.%${request.search_query}%,customer_name.ilike.%${request.search_query}%,customer_email.ilike.%${request.search_query}%`);
  }

  const { data: orders, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return {
    success: true,
    data: {
      orders: orders || [],
      total_count: count,
      page,
      page_size: pageSize
    }
  };
}

async function updateOrderStatus(request: OrderUpdateRequest): Promise<OrderUpdateResponse> {
  if (!request.order_id || !request.new_status || !request.admin_id) {
    throw new Error('Missing required fields: order_id, new_status, admin_id');
  }

  // First, get current order to check version
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders_new')
    .select('*')
    .eq('id', request.order_id)
    .single();

  if (fetchError || !currentOrder) {
    throw new Error('Order not found');
  }

  // Check for version conflict (optimistic locking)
  if (request.version && currentOrder.version !== request.version) {
    return {
      success: false,
      error: 'Order was updated by another admin',
      code: 'VERSION_CONFLICT',
      conflict: {
        current_version: currentOrder.version,
        current_status: currentOrder.status,
        last_updated_by: currentOrder.updated_by_name || 'Unknown',
        last_updated_at: currentOrder.updated_at
      }
    };
  }

  // Update the order status
  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders_new')
    .update({
      status: request.new_status,
      updated_by: request.admin_id,
      updated_by_name: request.admin_name || 'Admin',
      updated_at: new Date().toISOString()
    })
    .eq('id', request.order_id)
    .eq('version', currentOrder.version) // Double-check version
    .select()
    .single();

  if (updateError) {
    // Check if it's a version conflict
    if (updateError.message.includes('version')) {
      // Re-fetch current state for conflict info
      const { data: conflictOrder } = await supabase
        .from('orders_new')
        .select('*')
        .eq('id', request.order_id)
        .single();

      return {
        success: false,
        error: 'Order was updated by another admin',
        code: 'VERSION_CONFLICT',
        conflict: conflictOrder ? {
          current_version: conflictOrder.version,
          current_status: conflictOrder.status,
          last_updated_by: conflictOrder.updated_by_name || 'Unknown',
          last_updated_at: conflictOrder.updated_at
        } : undefined
      };
    }
    
    throw new Error(`Failed to update order: ${updateError.message}`);
  }

  if (!updatedOrder) {
    throw new Error('Order update returned no data - possible version conflict');
  }

  // Send notification email if status change is significant
  const notificationStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
  if (notificationStatuses.includes(request.new_status)) {
    await sendStatusNotification(updatedOrder, request.new_status);
  }

  return {
    success: true,
    data: updatedOrder
  };
}

async function assignRider(request: OrderUpdateRequest): Promise<OrderUpdateResponse> {
  if (!request.order_id || !request.rider_id || !request.admin_id) {
    throw new Error('Missing required fields: order_id, rider_id, admin_id');
  }

  const { data: schedule, error } = await supabase
    .from('order_delivery_schedule')
    .update({
      assigned_rider_id: request.rider_id,
      assigned_rider_name: request.rider_name || 'Rider',
      updated_at: new Date().toISOString()
    })
    .eq('order_id', request.order_id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to assign rider: ${error.message}`);
  }

  return {
    success: true,
    data: schedule
  };
}

async function addNotes(request: OrderUpdateRequest): Promise<OrderUpdateResponse> {
  if (!request.order_id || !request.notes || !request.admin_id) {
    throw new Error('Missing required fields: order_id, notes, admin_id');
  }

  // Add to audit log
  const { error } = await supabase
    .from('order_audit')
    .insert({
      order_id: request.order_id,
      admin_id: request.admin_id,
      admin_name: request.admin_name || 'Admin',
      notes: request.notes,
      action_type: 'add_notes'
    });

  if (error) {
    throw new Error(`Failed to add notes: ${error.message}`);
  }

  return {
    success: true,
    data: { message: 'Notes added successfully' }
  };
}

async function sendStatusNotification(order: any, newStatus: string) {
  try {
    // Queue email notification (non-blocking)
    await supabase.from('communication_events').insert({
      event_type: 'order_status_update',
      recipient_email: order.customer_email,
      template_key: `order_${newStatus}`,
      template_variables: {
        customer_name: order.customer_name,
        order_number: order.order_number,
        status: newStatus
      },
      order_id: order.id,
      status: 'queued'
    });
  } catch (error) {
    console.error('Failed to queue notification:', error);
    // Don't throw - this is non-critical
  }
}

function getErrorCode(errorMessage: string): string {
  if (errorMessage.includes('version') || errorMessage.includes('conflict')) {
    return 'VERSION_CONFLICT';
  }
  if (errorMessage.includes('not found')) {
    return 'NOT_FOUND';
  }
  if (errorMessage.includes('admin') || errorMessage.includes('permission')) {
    return 'PERMISSION_DENIED';
  }
  if (errorMessage.includes('validation') || errorMessage.includes('required')) {
    return 'VALIDATION_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

function getErrorStatus(errorMessage: string): number {
  if (errorMessage.includes('admin') || errorMessage.includes('permission')) {
    return 403;
  }
  if (errorMessage.includes('not found')) {
    return 404;
  }
  if (errorMessage.includes('validation') || errorMessage.includes('required')) {
    return 400;
  }
  if (errorMessage.includes('version') || errorMessage.includes('conflict')) {
    return 409;
  }
  return 500;
}