import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface OrderUpdateRequest {
  action: 'update' | 'list' | 'delete' | 'bulk_delete' | 'assign_rider' | 'log_admin_action' | 'log_admin_error';
  orderId?: string;
  orderIds?: string[];
  updates?: Record<string, any>;
  actionType?: string;
  details?: Record<string, any>;
  errorType?: string;
  error?: string;
  // List parameters
  page?: number;
  pageSize?: number;
  status?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    const startTime = Date.now();
    const { action, orderId, orderIds, updates, actionType, details, errorType, error, ...listParams }: OrderUpdateRequest = await req.json();
    
    console.log(`🚀 Admin Orders Manager: ${action} request started`);

    // Authenticate admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log(`✅ Admin authentication successful for user: ${user.id}`);

    // Rate limiting check
    const { data: rateLimitResult } = await supabase.rpc('check_admin_rate_limit', {
      p_admin_id: user.id,
      p_operation: action,
      p_limit: 100,
      p_window_minutes: 10
    });

    if (rateLimitResult && !rateLimitResult.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: `Rate limit exceeded. Try again in ${rateLimitResult.retry_after_minutes} minutes.`
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result;

    switch (action) {
      case 'list':
        result = await handleListOrders(supabase, listParams);
        break;
      
      case 'update':
        if (!orderId || !updates) {
          throw new Error('Missing orderId or updates for update action');
        }
        result = await handleUpdateOrder(supabase, orderId, updates, user.id);
        break;
      
      case 'delete':
        if (!orderId) {
          throw new Error('Missing orderId for delete action');
        }
        result = await handleDeleteOrder(supabase, orderId, user.id);
        break;
      
      case 'bulk_delete':
        if (!orderIds || orderIds.length === 0) {
          throw new Error('Missing orderIds for bulk_delete action');
        }
        result = await handleBulkDeleteOrders(supabase, orderIds, user.id);
        break;
      
      case 'assign_rider':
        if (!orderId || !updates?.assigned_rider_id) {
          throw new Error('Missing orderId or rider assignment for assign_rider action');
        }
        result = await handleAssignRider(supabase, orderId, updates.assigned_rider_id, user.id);
        break;
      
      case 'log_admin_action':
        result = await handleLogAdminAction(supabase, user.id, actionType!, orderId, details);
        break;
      
      case 'log_admin_error':
        result = await handleLogAdminError(supabase, user.id, orderId!, errorType!, error!);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Admin Orders Manager: ${action} completed in ${duration}ms`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ Admin Orders Manager error:`, error);
    
    // Enhanced error responses
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
      recovery_actions: [
        'Check network connection',
        'Refresh page and retry',
        'Verify authentication status'
      ]
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleListOrders(supabase: any, params: any) {
  const {
    page = 1,
    pageSize = 20,
    status = 'all',
    searchQuery = '',
    startDate,
    endDate
  } = params;

  console.log(`📋 Listing orders: page ${page}, status ${status}, search "${searchQuery}"`);

  try {
    // First, try the main query with proper relationship syntax
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (id, name, price, image_url)
        ),
        delivery_zones (
          id, name, base_fee, description
        ),
        order_delivery_schedule (
          delivery_date, delivery_time_start, delivery_time_end,
          special_instructions, is_flexible, requested_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (searchQuery.trim()) {
      query = query.or(`
        order_number.ilike.%${searchQuery}%,
        customer_name.ilike.%${searchQuery}%,
        customer_email.ilike.%${searchQuery}%,
        customer_phone.ilike.%${searchQuery}%
      `);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('❌ Primary query failed, trying fallback:', error);
      
      // Fallback: Query without delivery schedule relationship to prevent 500 errors
      let fallbackQuery = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (id, name, price, image_url)
          ),
          delivery_zones (
            id, name, base_fee, description
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Reapply filters for fallback
      if (status !== 'all') {
        fallbackQuery = fallbackQuery.eq('status', status);
      }

      if (searchQuery.trim()) {
        fallbackQuery = fallbackQuery.or(`
          order_number.ilike.%${searchQuery}%,
          customer_name.ilike.%${searchQuery}%,
          customer_email.ilike.%${searchQuery}%,
          customer_phone.ilike.%${searchQuery}%
        `);
      }

      if (startDate) {
        fallbackQuery = fallbackQuery.gte('created_at', startDate);
      }

      if (endDate) {
        fallbackQuery = fallbackQuery.lte('created_at', endDate);
      }

      fallbackQuery = fallbackQuery.range(offset, offset + pageSize - 1);

      const { data: fallbackOrders, error: fallbackError, count: fallbackCount } = await fallbackQuery;

      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        throw new Error(`Failed to fetch orders: ${fallbackError.message}`);
      }

      console.log('✅ Fallback query succeeded, fetching delivery schedules separately');
      
      // Fetch delivery schedules separately if needed
      if (fallbackOrders && fallbackOrders.length > 0) {
        const orderIds = fallbackOrders.map(order => order.id);
        const { data: schedules } = await supabase
          .from('order_delivery_schedule')
          .select('*')
          .in('order_id', orderIds);
        
        // Manually attach schedules to orders
        if (schedules) {
          fallbackOrders.forEach(order => {
            order.order_delivery_schedule = schedules.filter(schedule => schedule.order_id === order.id);
          });
        }
      }

      return {
        success: true,
        orders: fallbackOrders || [],
        count: fallbackCount || 0,
        page,
        pageSize,
        totalPages: Math.ceil((fallbackCount || 0) / pageSize),
        fallback_used: true
      };
    }

    console.log('✅ Primary query succeeded');
    return {
      success: true,
      orders: orders || [],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    };

  } catch (error) {
    console.error('❌ Critical error in handleListOrders:', error);
    
    // Final safety net: Return empty result instead of crashing
    return {
      success: false,
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : 'Unknown error',
      orders: [],
      count: 0,
      page,
      pageSize,
      totalPages: 0,
      critical_error: true
    };
  }
}

async function handleUpdateOrder(supabase: any, orderId: string, updates: any, adminId: string) {
  console.log(`📝 BULLETPROOF: Updating order ${orderId}:`, updates);

  // Use the bulletproof production-safe update function with zero duplicate key violations
  if (updates.status) {
    console.log(`🔒 Using bulletproof status update for order ${orderId}: ${updates.status}`);
    
    const { data, error } = await supabase.rpc('admin_update_order_status_bulletproof', {
      p_order_id: orderId,
      p_new_status: updates.status,
      p_admin_id: adminId
    });

    if (error) {
      console.error(`❌ Bulletproof status update failed:`, error);
      throw new Error(`Status update failed: ${error.message}`);
    }

    if (!data || !data.success) {
      console.error(`❌ Bulletproof status update returned unsuccessful:`, data);
      throw new Error(data?.error || 'Status update failed');
    }

    console.log(`✅ Bulletproof status update successful for order ${orderId}`);
    return data;
  }

  // For non-status updates, use direct database update with validation
  const allowedUpdates = ['customer_phone', 'delivery_notes', 'special_instructions'];
  const cleanedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedUpdates.includes(key))
  );

  if (Object.keys(cleanedUpdates).length === 0) {
    throw new Error('No valid updates provided');
  }

  const { data, error } = await supabase
    .from('orders')
    .update({
      ...cleanedUpdates,
      updated_at: new Date().toISOString(),
      updated_by: adminId
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Order update failed: ${error.message}`);
  }

  // Log the update
  await supabase.from('audit_logs').insert({
    action: 'admin_order_updated',
    category: 'Order Management',
    message: `Admin updated order fields: ${Object.keys(cleanedUpdates).join(', ')}`,
    user_id: adminId,
    entity_id: orderId,
    new_values: cleanedUpdates
  });

  return {
    success: true,
    order: data
  };
}

async function handleDeleteOrder(supabase: any, orderId: string, adminId: string) {
  console.log(`🗑️ Deleting order ${orderId}`);

  // First, get order details for audit logging
  const { data: order } = await supabase
    .from('orders')
    .select('order_number, customer_email, status')
    .eq('id', orderId)
    .single();

  // Delete the order
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    throw new Error(`Failed to delete order: ${error.message}`);
  }

  // Log the deletion
  await supabase.from('audit_logs').insert({
    action: 'admin_order_deleted',
    category: 'Order Management',
    message: `Admin deleted order ${order?.order_number || orderId}`,
    user_id: adminId,
    entity_id: orderId,
    old_values: order
  });

  return {
    success: true,
    message: 'Order deleted successfully'
  };
}

async function handleBulkDeleteOrders(supabase: any, orderIds: string[], adminId: string) {
  console.log(`🗑️ Bulk deleting ${orderIds.length} orders`);

  // Get order details for audit logging
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, customer_email, status')
    .in('id', orderIds);

  // Delete the orders
  const { error } = await supabase
    .from('orders')
    .delete()
    .in('id', orderIds);

  if (error) {
    throw new Error(`Failed to bulk delete orders: ${error.message}`);
  }

  // Log the bulk deletion
  await supabase.from('audit_logs').insert({
    action: 'admin_orders_bulk_deleted',
    category: 'Order Management',
    message: `Admin bulk deleted ${orderIds.length} orders`,
    user_id: adminId,
    new_values: { deleted_order_ids: orderIds, deleted_orders: orders }
  });

  return {
    success: true,
    message: `${orderIds.length} orders deleted successfully`
  };
}

async function handleAssignRider(supabase: any, orderId: string, riderId: string, adminId: string) {
  console.log(`🚴 Assigning rider ${riderId} to order ${orderId}`);

  const { data, error } = await supabase
    .from('orders')
    .update({
      assigned_rider_id: riderId,
      updated_at: new Date().toISOString(),
      updated_by: adminId
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to assign rider: ${error.message}`);
  }

  // Log the rider assignment
  await supabase.from('audit_logs').insert({
    action: 'admin_rider_assigned',
    category: 'Order Management',
    message: `Admin assigned rider to order`,
    user_id: adminId,
    entity_id: orderId,
    new_values: { assigned_rider_id: riderId }
  });

  return {
    success: true,
    order: data
  };
}

async function handleLogAdminAction(supabase: any, adminId: string, actionType: string, orderId?: string, details?: any) {
  await supabase.from('audit_logs').insert({
    action: actionType,
    category: 'Admin Action Monitoring',
    message: `Production admin action: ${actionType}`,
    user_id: adminId,
    entity_id: orderId,
    new_values: {
      details: details || {},
      timestamp: new Date().toISOString()
    }
  });

  return { success: true, message: 'Action logged successfully' };
}

async function handleLogAdminError(supabase: any, adminId: string, orderId: string, errorType: string, error: string) {
  await supabase.from('audit_logs').insert({
    action: errorType,
    category: 'Admin Error Monitoring',
    message: `Production admin error: ${errorType}`,
    user_id: adminId,
    entity_id: orderId,
    new_values: {
      error: error,
      timestamp: new Date().toISOString()
    }
  });

  return { success: true, message: 'Error logged successfully' };
}