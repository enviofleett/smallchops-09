import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Import shared CORS with inline fallback for production stability
let getCorsHeaders;
let handleCorsPreflightResponse;
try {
  const corsModule = await import('../_shared/cors.ts');
  getCorsHeaders = corsModule.getCorsHeaders;
  handleCorsPreflightResponse = corsModule.handleCorsPreflightResponse;
  console.log('✅ Loaded shared CORS module');
} catch (error) {
  console.warn('⚠️ Failed to load shared CORS, using inline fallback:', error);
  const FALLBACK_ALLOWED_ORIGINS = [
    'https://startersmallchops.com',
    'https://www.startersmallchops.com',
    'https://oknnklksdiqaifhxaccs.lovable.app',
    'https://id-preview--7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.app',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.sandbox.lovable.dev',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  const DEV_PATTERNS = [
    /^https:\/\/.*\.lovable\.app$/,
    /^https:\/\/.*\.sandbox\.lovable\.dev$/,
    /^http:\/\/localhost:\d+$/
  ];
  getCorsHeaders = (origin)=>{
    const baseHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'false'
    };
    if (!origin || !FALLBACK_ALLOWED_ORIGINS.includes(origin) && !DEV_PATTERNS.some((pattern)=>pattern.test(origin))) {
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': '*'
      };
    }
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    };
  };
  handleCorsPreflightResponse = (origin)=>{
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  };
}

const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

// Notification handler - with dedupe key and upsert fallback
async function handleStatusChangeNotification(supabaseClient, orderId, order, newStatus) {
  try {
    const validStatuses = [
      'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
      'delivered', 'cancelled', 'refunded', 'completed', 'returned'
    ];
    if (!newStatus || typeof newStatus !== 'string' || !validStatuses.includes(newStatus.trim())) {
      console.error(`❌ CRITICAL: Invalid status in notification handler: "${newStatus}"`);
      return;
    }
    const sanitizedStatus = newStatus.trim();
    const dedupeKey = `${orderId}_${sanitizedStatus}_order_status_update`;

    let notificationInserted = false;
    if (order.customer_email) {
      // Try upsert (preferred) or fallback to insert-if-not-exists
        try {
        // Map status to proper template key
        const templateKeyMap = {
          'confirmed': 'order_confirmed',
          'preparing': 'order_preparing', 
          'ready': 'order_ready',
          'out_for_delivery': 'order_out_for_delivery',
          'delivered': 'order_delivered',
          'cancelled': 'order_cancelled'
        };
        const templateKey = templateKeyMap[sanitizedStatus] || 'order_status_update';
        
        const templateVars = {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          status: sanitizedStatus,
          status_display: sanitizedStatus.replace('_', ' ').replace(/\b\w/g, l=>l.toUpperCase()),
          updated_at: new Date().toISOString()
        };

        const { error: upsertError } = await supabaseClient
          .from('communication_events')
          .upsert([{
            dedupe_key: dedupeKey,
            event_type: 'order_status_update',
            channel: 'email',
            recipient_email: order.customer_email,
            order_id: orderId,
            status: 'queued',
            template_key: templateKey,
            template_variables: templateVars,
            source: 'admin_update',
            priority: 'high',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }], { onConflict: 'dedupe_key' });

        if (upsertError) {
          if (upsertError.message.includes('duplicate key')) {
            console.log('⚠️ Duplicate notification event, skipping email insert.');
            notificationInserted = false;
          } else {
            throw upsertError;
          }
        } else {
          notificationInserted = true;
          console.log('✅ Email notification queued (dedupe handled).');
        }
      } catch (emailError) {
        console.log(`⚠️ Email notification upsert/insert failed: ${emailError.message}`);
      }
    }

    if (!notificationInserted && order.customer_phone) {
      // SMS Fallback: insert-if-not-exists using dedupe key
      try {
        const smsTemplateVars = {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          status: sanitizedStatus,
          message: `Hi ${order.customer_name || 'Customer'}! Your order ${order.order_number} status has been updated to: ${sanitizedStatus.replace('_', ' ').replace(/\b\w/g, l=>l.toUpperCase())}. Thank you for choosing us!`
        };

        const { error: smsInsertError } = await supabaseClient.from('communication_events').upsert([{
          dedupe_key: `${dedupeKey}_sms`,
          event_type: 'order_status_update',
          channel: 'sms',
          sms_phone: order.customer_phone,
          template_variables: smsTemplateVars,
          order_id: orderId,
          status: 'queued',
          priority: 'high',
          source: 'admin_update_sms',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }], { onConflict: 'dedupe_key' });

        if (smsInsertError) {
          if (smsInsertError.message.includes('duplicate key')) {
            console.log('⚠️ Duplicate SMS notification event, skipping insert.');
          } else {
            throw smsInsertError;
          }
        } else {
          console.log('✅ SMS fallback notification queued.');
        }
      } catch (smsError) {
        console.log(`⚠️ SMS fallback notification failed: ${smsError.message}`);
      }
    }

    await supabaseClient.from('audit_logs').insert([{
      action: 'status_change_notification_attempted',
      category: 'Order Management',
      message: `Notification attempted for order ${order.order_number} status change to ${sanitizedStatus}`,
      entity_id: orderId,
      new_values: {
        old_status: order.status,
        new_status: sanitizedStatus,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        notification_channels_attempted: [
          order.customer_email ? 'email' : null,
          order.customer_phone ? 'sms' : null
        ].filter(Boolean)
      }
    }]);
  } catch (error) {
    console.error(`⚠️ Complete notification failure for order ${orderId}:`, error);
  }
}

serve(async (req)=>{
  const origin = req.headers.get('origin');
  console.log(`🚀 Admin Orders Manager: ${req.method} request from origin: ${origin}`);
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return handleCorsPreflightResponse(origin);
  }
  const corsHeaders = getCorsHeaders(origin);

  // Authentication
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Missing authentication token'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid authentication token'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }
    const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('role, is_active').eq('id', user.id).single();
    if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Forbidden: Admin access required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }
    console.log('✅ Admin authentication successful for user:', user.id);
  } catch (authError) {
    console.error('❌ Authentication error:', authError);
    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  try {
    let { action, orderId, updates, riderId, page, pageSize, status, searchQuery, startDate, endDate, orderIds } = await req.json();

    switch(action){
      case 'list': {
        console.log('Admin function: Listing orders', { page, pageSize, status, searchQuery, startDate, endDate });
        let query = supabaseClient.from('orders').select(`
          *,
          order_items (*),
          order_delivery_schedule (*),
          delivery_zones (id, name, base_fee, is_active)
        `, { count: 'exact' });

        query = query.order('order_time', { ascending: false });

        if (status === 'confirmed') {
          query = query.eq('status', status).eq('payment_status', 'paid');
        } else if (status !== 'all') {
          query = query.eq('status', status);
        }

        if (searchQuery) {
          const searchString = `%${searchQuery}%`;
          query = query.or(`order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`);
        }

        if (startDate && endDate) {
          query = query.gte('order_time', startDate).lte('order_time', endDate);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await query.range(from, to);

        if (error) {
          // Fallback: only select orders, fetch relations separately
          let fallbackQuery = supabaseClient.from('orders').select('*', { count: 'exact' });
          if (status === 'confirmed') {
            fallbackQuery = fallbackQuery.eq('status', status).eq('payment_status', 'paid');
          } else if (status !== 'all') {
            fallbackQuery = fallbackQuery.eq('status', status);
          }
          if (searchQuery) {
            const searchString = `%${searchQuery}%`;
            fallbackQuery = fallbackQuery.or(`order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`);
          }
          if (startDate && endDate) {
            fallbackQuery = fallbackQuery.gte('order_time', startDate).lte('order_time', endDate);
          }
          fallbackQuery = fallbackQuery.order('order_time', { ascending: false });
          const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery.range(from, to);
          if (fallbackError) {
            return new Response(JSON.stringify({
              success: false,
              error: fallbackError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
          // Fetch related data separately
          const orderIds = fallbackData?.map(order=>order.id) || [];
          const [itemsResult, schedulesResult, zonesResult] = await Promise.all([
            supabaseClient.from('order_items').select('*').in('order_id', orderIds),
            supabaseClient.from('order_delivery_schedule').select('*').in('order_id', orderIds),
            supabaseClient.from('delivery_zones').select('id, name, base_fee, is_active')
          ]);
          const enrichedOrders = fallbackData?.map(order=>({
            ...order,
            order_items: itemsResult.data?.filter(item=>item.order_id === order.id) || [],
            order_delivery_schedule: schedulesResult.data?.filter(schedule=>schedule.order_id === order.id) || [],
            delivery_zones: zonesResult.data?.find(zone=>zone.id === order.delivery_zone_id) || null
          }));
          return new Response(JSON.stringify({
            success: true,
            orders: enrichedOrders,
            count: fallbackCount || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({
          success: true,
          orders: data,
          count: count || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'assign_rider': {
        console.log('🎯 Admin function: Assigning rider', riderId, 'to order', orderId);
        if (!riderId || riderId === 'null' || riderId === '' || riderId === undefined) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid rider ID: Rider ID cannot be null, undefined, or empty'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        const { data: orderCheck, error: orderCheckError } = await supabaseClient.from('orders').select('id, status, order_number').eq('id', orderId).single();
        if (orderCheckError || !orderCheck) {
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        if (['confirmed', 'preparing', 'ready'].includes(orderCheck.status)) {
          const { data: result, error: rpcError } = await supabaseClient.rpc('start_delivery', {
            p_order_id: orderId,
            p_rider_id: riderId
          });
          if (rpcError) {
            return new Response(JSON.stringify({
              success: false,
              error: rpcError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          }
          const { data: updatedOrder } = await supabaseClient.from('orders').select(`
            *,
            order_items (*),
            order_delivery_schedule (*),
            delivery_zones (id, name, base_fee, is_active)
          `).eq('id', orderId).single();
          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Order ${orderCheck.order_number} started for delivery`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (orderCheck.status === 'out_for_delivery') {
          const { data: result, error: rpcError } = await supabaseClient.rpc('reassign_order_rider', {
            p_order_id: orderId,
            p_new_rider_id: riderId,
            p_reason: 'Admin reassignment via dashboard'
          });
          if (rpcError) {
            return new Response(JSON.stringify({
              success: false,
              error: rpcError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          }
          const { data: updatedOrder } = await supabaseClient.from('orders').select(`
            *,
            order_items (*),
            order_delivery_schedule (*),
            delivery_zones (id, name, base_fee, is_active)
          `).eq('id', orderId).single();
          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Rider reassigned for order ${orderCheck.order_number}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: `Order ${orderCheck.order_number} cannot have rider assigned in status: ${orderCheck.status}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
      }

      case 'update': {
        console.log('Admin function: Updating order', orderId, 'with updates:', JSON.stringify(updates));
        const { data: currentOrder, error: fetchError } = await supabaseClient.from('orders').select('status, customer_email, customer_name, order_number').eq('id', orderId).single();
        if (fetchError) {
          return new Response(JSON.stringify({
            success: false,
            error: fetchError.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        const allowedColumns = [
          'status', 'customer_name', 'customer_phone', 'customer_email', 'delivery_address',
          'delivery_instructions', 'order_notes', 'assigned_rider_id', 'payment_status',
          'total_amount', 'delivery_zone_id', 'order_type', 'special_instructions',
          'internal_notes', 'updated_at'
        ];
        const validStatuses = [
          'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
          'delivered', 'cancelled', 'refunded', 'completed', 'returned'
        ];
        const sanitizedUpdates = {};
        if (updates && typeof updates === 'object') {
          for (const [key, value] of Object.entries(updates)){
            if (key === 'status') {
              if (value === null || value === 'null' || value === '' || value === undefined || typeof value !== 'string') {
                return new Response(JSON.stringify({
                  success: false,
                  error: 'Status cannot be null, undefined, empty, or non-string value'
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400
                });
              }
              const trimmedStatus = value.trim();
              if (!trimmedStatus || !validStatuses.includes(trimmedStatus)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Invalid status value: "${value}". Valid values are: ${validStatuses.join(', ')}`
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400
                });
              }
              sanitizedUpdates[key] = trimmedStatus;
            } else if (key === 'assigned_rider_id') {
              sanitizedUpdates[key] = (value === 'null' || value === '') ? null : value;
            } else if (allowedColumns.includes(key)) {
              sanitizedUpdates[key] = value;
            }
          }
        }
        sanitizedUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseClient.from('orders').update(sanitizedUpdates)
          .eq('id', orderId)
          .select(`
            *,
            order_items (*),
            delivery_zones (id, name, base_fee, is_active),
            order_delivery_schedule (*)
          `).single();
        if (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        // Background notification for status change - trigger instant processing
        if (sanitizedUpdates.status && sanitizedUpdates.status !== currentOrder.status) {
          try {
            // Queue notifications (fire-and-forget)
            handleStatusChangeNotification(supabaseClient, orderId, currentOrder, sanitizedUpdates.status).catch(error => {
              console.error('⚠️ Notification queuing failed (non-blocking):', error);
            });
            
            // Process notifications instantly (fire-and-forget)
            supabaseClient.functions.invoke('instant-email-processor', {
              body: { priority: 'high', limit: 5 }
            }).then(result => {
              console.log('📧 Instant email processing result:', result.data);
            }).catch(error => {
              console.error('⚠️ Instant email processing failed (non-blocking):', error);
            });
          } catch (error) {
            console.error('⚠️ Background notification setup failed (non-blocking):', error);
          }
        }
        return new Response(JSON.stringify({
          success: true,
          order: data
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        console.log('Admin function: Deleting order', orderId);
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Order deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'bulk_delete': {
        console.log('Admin function: Bulk deleting orders', orderIds);
        const { error } = await supabaseClient.from('orders').delete().in('id', orderIds);
        if (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Orders deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
    }
  } catch (error) {
    console.error('❌ Admin orders manager error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
