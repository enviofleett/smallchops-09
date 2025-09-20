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

// Template key mapping helper function
function getTemplateKey(status: string): string {
  const templateKeyMap: Record<string, string> = {
    'confirmed': 'order_confirmed',
    'preparing': 'order_preparing', 
    'ready': 'order_ready',
    'out_for_delivery': 'order_out_for_delivery',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancelled'
  };
  return templateKeyMap[status] || 'order_status_update';
}
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
    // PRODUCTION FIX: Enhanced collision-resistant dedupe key with microsecond precision + entropy
    const timestamp = Date.now();
    const microseconds = performance.now() * 1000;
    const entropy = Math.random().toString(36).substring(2, 10);
    const sessionId = 'admin_session'; // Will be enhanced with actual session tracking
    const dedupeKey = `${orderId}_${sanitizedStatus}_${timestamp}_${Math.floor(microseconds)}_${entropy}_${sessionId}`;

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
          total_amount: order.total_amount?.toLocaleString() || '0',
          order_date: new Date(order.order_time || new Date()).toLocaleDateString(),
          updated_at: new Date().toISOString()
        };

        // PRODUCTION FIX: Enhanced upsert with collision tracking
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
            admin_session_id: adminUserId,
            retry_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }], { onConflict: 'order_id,event_type,dedupe_key', ignoreDuplicates: true });

        if (upsertError) {
          if (upsertError.message.includes('duplicate key') || upsertError.message.includes('violates unique constraint')) {
            console.log('⚠️ Collision detected, logging for monitoring and continuing.');
            // Log collision for production monitoring
            try {
              await supabaseClient.from('communication_events_collision_log').insert({
                original_dedupe_key: dedupeKey,
                order_id: orderId,
                event_type: 'order_status_update',
                admin_session_ids: [adminUserId],
                resolution_strategy: 'ignore_duplicate'
              });
            } catch (logError) {
              console.warn('⚠️ Failed to log collision:', logError.message);
            }
            notificationInserted = false;
          } else {
            throw upsertError;
          }
        } else {
          notificationInserted = true;
          console.log('✅ Email notification queued successfully with enhanced dedupe.');
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
        }]);

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

    // CRITICAL FIX: Wrap audit log insertion in try-catch
    try {
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
    } catch (auditError) {
      console.error('⚠️ Audit log insertion failed (non-blocking):', auditError.message);
    }
  } catch (error) {
    console.error(`⚠️ Complete notification failure for order ${orderId}:`, error);
  }
}

serve(async (req)=>{
  const origin = req.headers.get('origin');
  
  // Generate correlation ID for request tracing
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚀 Admin Orders Manager: ${req.method} request from origin: ${origin} [${correlationId}]`);
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  // Enhanced cleanup on function startup for better reliability
  try {
    // Clean up expired locks
    const { data: lockCleanupResult } = await supabaseClient.rpc('cleanup_expired_locks');
    if (lockCleanupResult > 0) {
      console.log(`🧹 Cleaned up ${lockCleanupResult} expired locks [${correlationId}]`);
    }
    
    // Clean up stuck cache entries
    const { data: cacheCleanupResult } = await supabaseClient.rpc('cleanup_stuck_request_cache');
    if (cacheCleanupResult?.expired_cleaned > 0 || cacheCleanupResult?.stuck_processing_fixed > 0) {
      console.log(`🧹 Cache cleanup: ${cacheCleanupResult.expired_cleaned} expired, ${cacheCleanupResult.stuck_processing_fixed} stuck entries [${correlationId}]`);
    }
  } catch (cleanupError) {
    console.warn(`⚠️ Startup cleanup failed (non-blocking): ${cleanupError.message} [${correlationId}]`);
  }

  // Declare user variable at function scope so it's accessible throughout
  let user = null;

  // Enhanced Authentication with Production Error Handling
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🔒 Authentication failed: Missing or invalid authorization header');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Missing authentication token',
        errorCode: 'MISSING_AUTH_TOKEN'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Step 1: Verify JWT token
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    user = authData?.user; // Assign to the function-scoped user variable
    if (authError) {
      console.warn('🔒 Authentication failed: JWT verification error:', authError.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid authentication token',
        errorCode: 'INVALID_JWT_TOKEN'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    if (!user?.id) {
      console.warn('🔒 Authentication failed: No user found in JWT token');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: User not found',
        errorCode: 'USER_NOT_FOUND'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Step 2: Check admin status with fallback authentication
    let isAdmin = false;
    let authMethod = 'unknown';

    try {
      // Primary: Check profiles table (using maybeSingle to handle missing profiles)
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('⚠️ Profile lookup failed:', profileError.message);
        // Continue to fallback authentication
      } else if (profile) {
        isAdmin = profile.role === 'admin' && profile.is_active;
        authMethod = 'profiles_table';
        console.log('✅ Profile authentication:', { userId: user.id, role: profile.role, isActive: profile.is_active });
      } else {
        console.warn('⚠️ No profile found for user:', user.id);
        // Continue to fallback authentication
      }

      // Fallback: Use database function if profile lookup failed or returned null
      if (!isAdmin) {
        console.log('🔄 Attempting fallback authentication using is_admin() function');
        const { data: adminCheck, error: adminError } = await supabaseClient.rpc('is_admin');
        
        if (adminError) {
          console.error('❌ Fallback admin check failed:', adminError.message);
        } else {
          isAdmin = Boolean(adminCheck);
          authMethod = 'is_admin_function';
          console.log('✅ Fallback authentication result:', { userId: user.id, isAdmin, method: authMethod });
        }
      }

    } catch (profileLookupError) {
      console.error('❌ Critical error during admin verification:', profileLookupError.message);
      // Log for monitoring but continue with final authorization check
    }

    // Step 3: Final authorization check
    if (!isAdmin) {
      console.warn('🚫 Admin access denied:', { 
        userId: user.id, 
        email: user.email,
        authMethod,
        timestamp: new Date().toISOString()
      });
      
      // Log security event
      try {
        await supabaseClient.from('audit_logs').insert([{
          action: 'admin_access_denied',
          category: 'Security Alert',
          message: `Admin access denied for user ${user.id} via ${authMethod}`,
          user_id: user.id,
          new_values: { 
            auth_method: authMethod, 
            user_email: user.email,
            timestamp: new Date().toISOString()
          }
        }]);
      } catch (auditError) {
        console.error('⚠️ Failed to log security event:', auditError.message);
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Forbidden: Admin access required',
        errorCode: 'INSUFFICIENT_PRIVILEGES'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    console.log('✅ Admin authentication successful:', { 
      userId: user.id, 
      email: user.email,
      authMethod,
      timestamp: new Date().toISOString()
    });

    // Log successful admin access
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'admin_access_granted',
        category: 'Admin Activity',
        message: `Admin access granted for user ${user.id} via ${authMethod}`,
        user_id: user.id,
        new_values: { 
          auth_method: authMethod,
          user_email: user.email,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (auditError) {
      console.error('⚠️ Failed to log admin access:', auditError.message);
    }

  } catch (authError) {
    console.error('❌ Critical authentication error:', {
      error: authError.message,
      stack: authError.stack,
      timestamp: new Date().toISOString()
    });

    // Log critical security event
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'authentication_system_error',
        category: 'Critical Security Alert',
        message: `Authentication system error: ${authError.message}`,
        new_values: { 
          error: authError.message,
          stack: authError.stack,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (auditError) {
      console.error('⚠️ Failed to log critical security event:', auditError.message);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication system error',
      errorCode: 'AUTH_SYSTEM_ERROR'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // Request Processing with Enhanced Error Handling
  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('❌ Invalid JSON in request body:', jsonError.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body',
        errorCode: 'INVALID_JSON'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Validate required fields based on action
    const { action, orderId, updates, riderId, page, pageSize, status, searchQuery, startDate, endDate, orderIds } = requestBody;
    
    if (!action || typeof action !== 'string') {
      console.error('❌ Missing or invalid action parameter:', action);
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing or invalid action parameter',
        errorCode: 'INVALID_ACTION'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('📋 Processing admin request:', { 
      action, 
      orderId: orderId || 'N/A',
      timestamp: new Date().toISOString()
    });

    switch(action){
      case 'list': {
        const startTime = Date.now();
        
        console.log('Admin function: Listing orders', { page, pageSize, status, searchQuery, startDate, endDate });
        
        // Get orders with enhanced error handling and lock status
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

          // Get lock information for fallback orders
          const ordersWithLockInfo = await Promise.all(
            enrichedOrders?.map(async (order) => {
              try {
                const { data: lockInfo } = await supabaseClient
                  .rpc('get_order_lock_info', { p_order_id: order.id });
                
                const lockData = lockInfo && lockInfo.length > 0 ? lockInfo[0] : {
                  is_locked: false,
                  locking_admin_id: null,
                  locking_admin_name: null,
                  locking_admin_avatar: null,
                  locking_admin_email: null,
                  lock_expires_at: null,
                  seconds_remaining: 0,
                  acquired_at: null
                };

                return {
                  ...order,
                  lock_info: lockData
                };
              } catch (error) {
                console.warn(`Failed to get lock info for order ${order.id}:`, error);
                return {
                  ...order,
                  lock_info: {
                    is_locked: false,
                    locking_admin_id: null,
                    locking_admin_name: null,
                    locking_admin_avatar: null,
                    locking_admin_email: null,
                    lock_expires_at: null,
                    seconds_remaining: 0,
                    acquired_at: null
                  }
                };
              }
            }) || []
          );

          return new Response(JSON.stringify({
            success: true,
            orders: ordersWithLockInfo,
            count: fallbackCount || 0,
            metadata: {
              request_time: Date.now() - startTime,
              correlation_id: correlationId
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get lock information for successful orders
        const ordersWithLockInfo = await Promise.all(
          data?.map(async (order) => {
            try {
              const { data: lockInfo } = await supabaseClient
                .rpc('get_order_lock_info', { p_order_id: order.id });
              
              const lockData = lockInfo && lockInfo.length > 0 ? lockInfo[0] : {
                is_locked: false,
                locking_admin_id: null,
                locking_admin_name: null,
                locking_admin_avatar: null,
                locking_admin_email: null,
                lock_expires_at: null,
                seconds_remaining: 0,
                acquired_at: null
              };

              return {
                ...order,
                lock_info: lockData
              };
            } catch (error) {
              console.warn(`Failed to get lock info for order ${order.id}:`, error);
              return {
                ...order,
                lock_info: {
                  is_locked: false,
                  locking_admin_id: null,
                  locking_admin_name: null,
                  locking_admin_avatar: null,
                  locking_admin_email: null,
                  lock_expires_at: null,
                  seconds_remaining: 0,
                  acquired_at: null
                }
              };
            }
          }) || []
        );

        return new Response(JSON.stringify({
          success: true,
          orders: ordersWithLockInfo,
          count: count || 0,
          metadata: {
            request_time: Date.now() - startTime,
            correlation_id: correlationId
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'assign_rider': {
        console.log('🎯 Admin function: Assigning rider', riderId, 'to order', orderId);
        
        // Enhanced validation with detailed logging
        if (!riderId || riderId === 'null' || riderId === '' || riderId === undefined) {
          console.error('❌ Rider assignment failed: Invalid rider ID', { riderId, orderId });
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid rider ID: Rider ID cannot be null, undefined, or empty',
            errorCode: 'INVALID_RIDER_ID',
            context: { providedRiderId: riderId, orderId }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // Pre-validation: Check if rider exists and is active
        const { data: riderCheck, error: riderCheckError } = await supabaseClient
          .from('drivers')
          .select('id, name, is_active, vehicle_type')
          .eq('id', riderId)
          .single();

        if (riderCheckError || !riderCheck) {
          console.error('❌ Rider assignment failed: Rider not found', { 
            riderId, 
            orderId, 
            error: riderCheckError?.message 
          });
          
          // Get available active riders for suggestion
          const { data: activeRiders } = await supabaseClient
            .from('drivers')
            .select('id, name, vehicle_type')
            .eq('is_active', true)
            .limit(5);

          return new Response(JSON.stringify({
            success: false,
            error: `Rider not found with ID: ${riderId}`,
            errorCode: 'RIDER_NOT_FOUND',
            context: { 
              attemptedRiderId: riderId, 
              orderId,
              availableRiders: activeRiders || []
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        if (!riderCheck.is_active) {
          console.error('❌ Rider assignment failed: Rider is inactive', { 
            riderId: riderCheck.id, 
            riderName: riderCheck.name, 
            orderId 
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: `Rider "${riderCheck.name}" is currently inactive`,
            errorCode: 'RIDER_INACTIVE',
            context: { 
              riderId: riderCheck.id,
              riderName: riderCheck.name,
              orderId
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        const { data: orderCheck, error: orderCheckError } = await supabaseClient.from('orders').select('id, status, order_number').eq('id', orderId).single();
        if (orderCheckError || !orderCheck) {
          console.error('❌ Rider assignment failed: Order not found', { 
            orderId, 
            riderId, 
            error: orderCheckError?.message 
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`,
            errorCode: 'ORDER_NOT_FOUND',
            context: { orderId, riderId }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        if (['confirmed', 'preparing', 'ready'].includes(orderCheck.status)) {
          console.log('🚀 Starting delivery for order', orderCheck.order_number, 'with rider', riderCheck.name);
          
          const { data: result, error: rpcError } = await supabaseClient.rpc('start_delivery', {
            p_order_id: orderId,
            p_rider_id: riderId
          });
          
          if (rpcError) {
            console.error('❌ start_delivery RPC failed:', { 
              orderId, 
              orderNumber: orderCheck.order_number,
              orderStatus: orderCheck.status,
              riderId: riderCheck.id, 
              riderName: riderCheck.name,
              riderActive: riderCheck.is_active,
              rpcError: rpcError.message,
              rpcCode: rpcError.code,
              rpcDetails: rpcError.details
            });
            
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to assign rider: ${rpcError.message}`,
              errorCode: 'START_DELIVERY_FAILED',
              context: {
                orderId,
                orderNumber: orderCheck.order_number,
                orderStatus: orderCheck.status,
                riderId: riderCheck.id,
                riderName: riderCheck.name,
                rpcError: rpcError.message,
                rpcCode: rpcError.code
              }
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
          
          console.log('✅ Rider assignment successful:', { 
            orderId, 
            orderNumber: orderCheck.order_number,
            riderId: riderCheck.id, 
            riderName: riderCheck.name 
          });
          
          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Order ${orderCheck.order_number} started for delivery with rider ${riderCheck.name}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (orderCheck.status === 'out_for_delivery') {
          console.log('🔄 Reassigning rider for order', orderCheck.order_number, 'from current rider to', riderCheck.name);
          
          const { data: result, error: rpcError } = await supabaseClient.rpc('reassign_order_rider', {
            p_order_id: orderId,
            p_new_rider_id: riderId,
            p_reason: 'Admin reassignment via dashboard'
          });
          
          if (rpcError) {
            console.error('❌ reassign_order_rider RPC failed:', { 
              orderId, 
              orderNumber: orderCheck.order_number,
              orderStatus: orderCheck.status,
              newRiderId: riderCheck.id, 
              newRiderName: riderCheck.name,
              riderActive: riderCheck.is_active,
              rpcError: rpcError.message,
              rpcCode: rpcError.code,
              rpcDetails: rpcError.details
            });
            
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to reassign rider: ${rpcError.message}`,
              errorCode: 'REASSIGN_RIDER_FAILED',
              context: {
                orderId,
                orderNumber: orderCheck.order_number,
                orderStatus: orderCheck.status,
                newRiderId: riderCheck.id,
                newRiderName: riderCheck.name,
                rpcError: rpcError.message,
                rpcCode: rpcError.code
              }
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
          
          console.log('✅ Rider reassignment successful:', { 
            orderId, 
            orderNumber: orderCheck.order_number,
            newRiderId: riderCheck.id, 
            newRiderName: riderCheck.name 
          });
          
          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Rider reassigned to ${riderCheck.name} for order ${orderCheck.order_number}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.error('❌ Invalid order status for rider assignment:', { 
            orderId, 
            orderNumber: orderCheck.order_number,
            currentStatus: orderCheck.status,
            validStatuses: ['confirmed', 'preparing', 'ready', 'out_for_delivery']
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: `Order ${orderCheck.order_number} cannot have rider assigned in status: ${orderCheck.status}`,
            errorCode: 'INVALID_ORDER_STATUS',
            context: {
              orderId,
              orderNumber: orderCheck.order_number,
              currentStatus: orderCheck.status,
              validStatuses: ['confirmed', 'preparing', 'ready', 'out_for_delivery']
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
      }

      case 'bypass_and_update': {
        console.log(`🚨 Admin function: BYPASS cache and update order ${orderId} [${correlationId}]`);
        
        // Enhanced parameter validation for bypass
        if (!orderId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order ID is required for bypass update'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        if (!updates || typeof updates !== 'object' || !updates.status) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Status update is required for bypass operation'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // Call the manual bypass function directly
        const { data: bypassResult, error: bypassError } = await supabaseClient.rpc('manual_cache_bypass_and_update', {
          p_order_id: orderId,
          p_new_status: updates.status,
          p_admin_user_id: adminUserId,
          p_bypass_reason: 'admin_409_conflict_resolution'
        });

        if (bypassError) {
          console.error(`❌ Manual bypass failed [${correlationId}]:`, bypassError);
          return new Response(JSON.stringify({
            success: false,
            error: `Bypass operation failed: ${bypassError.message}`,
            bypassed: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        if (!bypassResult?.success) {
          return new Response(JSON.stringify({
            success: false,
            error: bypassResult?.error || 'Bypass operation failed',
            bypassed: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        console.log(`✅ Manual cache bypass successful [${correlationId}]:`, {
          orderId,
          cacheCleared: bypassResult.cache_cleared,
          statusChange: `${bypassResult.old_status} → ${bypassResult.new_status}`
        });

        return new Response(JSON.stringify({
          ...bypassResult,
          correlationId,
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Cache-Bypassed': 'true'
          }
        });
      }

      case 'update': {
        console.log(`📋 Processing admin request: {
  action: "update",
  orderId: "${orderId}",
  timestamp: "${new Date().toISOString()}"
} [${correlationId}]`);
        console.log('Admin function: Updating order', orderId, 'with updates:', JSON.stringify(updates));
        
        // PRODUCTION FIX: Use maybeSingle() to prevent errors when no records found
        const { data: currentOrder, error: fetchError } = await supabaseClient
          .from('orders')
          .select('status, customer_email, customer_name, order_number')
          .eq('id', orderId)
          .maybeSingle();
          
        if (fetchError) {
          console.error('❌ Failed to fetch current order:', { orderId, error: fetchError.message });
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to fetch order: ${fetchError.message}`,
            errorCode: 'ORDER_FETCH_FAILED'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        if (!currentOrder) {
          console.error('❌ Order not found:', { orderId });
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`,
            errorCode: 'ORDER_NOT_FOUND'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404
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
                  error: 'Status cannot be null, undefined, empty, or non-string value',
                  errorCode: 'INVALID_STATUS_VALUE'
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400
                });
              }
              const trimmedStatus = value.trim();
              if (!trimmedStatus || !validStatuses.includes(trimmedStatus)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Invalid status value: "${value}". Valid values are: ${validStatuses.join(', ')}`,
                  errorCode: 'INVALID_STATUS_VALUE'
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

        // CRITICAL FIX: Generate deterministic idempotency key WITHOUT timestamp for true idempotency
        const adminUserId = user.id;
        const idempotencyKey = `order_update_${orderId}_${sanitizedUpdates.status}_${adminUserId}`;

        // CRITICAL FIX: Use lock-first approach - this will acquire lock BEFORE cache operations
        const { data: lockFirstResult, error: lockFirstError } = await supabaseClient.rpc('admin_update_order_status_lock_first', {
          p_order_id: orderId,
          p_new_status: sanitizedUpdates.status,
          p_admin_id: adminUserId,
          p_idempotency_key: idempotencyKey
        });

        // CRITICAL FIX: Handle lock-first result directly
        if (lockFirstError) {
          console.error(`❌ Lock-first update failed for order ${orderId} [${correlationId}]:`, lockFirstError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Database error during order update',
            correlationId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        if (!lockFirstResult?.success) {
          // Handle concurrent update error
          if (lockFirstResult?.error === 'CONCURRENT_UPDATE_IN_PROGRESS') {
            console.log(`⚠️ Concurrent update detected for order ${orderId} [${correlationId}]`);
            
            return new Response(JSON.stringify({
              success: false,
              error: 'Another admin session is currently updating this order. Please wait and try again.',
              errorCode: 'CONCURRENT_UPDATE_IN_PROGRESS',
              lockHolder: lockFirstResult?.lock_holder,
              correlationId,
              retryAfter: 5 // seconds
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 409
            });
          }

          // Handle other errors
          console.error(`❌ Order update failed for ${orderId} [${correlationId}]:`, lockFirstResult?.error);
          return new Response(JSON.stringify({
            success: false,
            error: lockFirstResult?.error || 'Order update failed',
            correlationId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // CRITICAL FIX: Lock-first approach completed successfully
        console.log(`✅ Order ${orderId} updated successfully via lock-first approach [${correlationId}]`);
        
        const result = {
          success: true,
          message: lockFirstResult.message,
          order: lockFirstResult.order,
          oldStatus: lockFirstResult.old_status,
          newStatus: lockFirstResult.new_status,
          correlationId,
          idempotency_key: idempotencyKey,
          lock_first_approach: true,
          timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'bypass_and_update': {
            .eq('id', orderId)
            .select('*')
            .maybeSingle();

          if (updateError) {
            console.error(`❌ Order update failed: ${updateError.message} [${correlationId}]`, { orderId });
            
            // Determine specific error type for better user feedback
            let errorCode = 'ORDER_UPDATE_FAILED';
            let userMessage = 'Failed to update order. Please try again.';
            let httpStatus = 500;
            
            if (updateError.message?.includes('violates check constraint')) {
              errorCode = 'INVALID_DATA';
              userMessage = 'Invalid data provided. Please check your input and try again.';
              httpStatus = 400;
            } else if (updateError.message?.includes('duplicate key')) {
              errorCode = 'DUPLICATE_DATA';
              userMessage = 'This change conflicts with existing data. Please refresh and try again.';
              httpStatus = 409;
            }
            
            throw new Error(JSON.stringify({
              success: false,
              error: userMessage,
              errorCode,
              correlationId,
              httpStatus
            }));
          }

          if (!basicOrder) {
            console.error(`❌ Order not found after update: ${orderId} [${correlationId}]`);
            throw new Error(JSON.stringify({
              success: false,
              error: `Order not found after update: ${orderId}`,
              errorCode: 'ORDER_NOT_FOUND_AFTER_UPDATE',
              correlationId,
              httpStatus: 404
            }));
          }

          // Step 2: Fetch relations separately with NULL-safe LEFT JOINs
          const { data: orderWithRelations, error: fetchRelationsError } = await supabaseClient
            .from('orders')
            .select(`
              *,
              order_items (*),
              delivery_zones!left (id, name, base_fee, is_active),
              order_delivery_schedule!left (*)
            `)
            .eq('id', orderId)
            .maybeSingle();

          // Use fallback if relations fetch fails
          if (fetchRelationsError) {
            console.warn(`⚠️ Failed to fetch order relations, using basic order [${correlationId}]:`, { 
              orderId, 
              error: fetchRelationsError.message 
            });
            updatedOrder = basicOrder;
          } else {
            updatedOrder = orderWithRelations || basicOrder;
          }

        } catch (error) {
          // Parse structured errors from above
          if (error.message.startsWith('{')) {
            try {
              const errorData = JSON.parse(error.message);
              return new Response(JSON.stringify(errorData), {
                headers: { 
                  ...corsHeaders, 
                  'Content-Type': 'application/json',
                  'X-Correlation-ID': correlationId
                },
                status: errorData.httpStatus || 500
              });
            } catch (parseError) {
              // Fall through to generic error handling
            }
          }
          
          // Generic error handling
          console.error(`❌ Critical error during order update [${correlationId}]:`, { 
            orderId, 
            error: error.message,
            stack: error.stack 
          });
          
          throw new Error(JSON.stringify({
            success: false,
            error: `Database operation failed: ${error.message}`,
            errorCode: 'DATABASE_OPERATION_FAILED',
            correlationId,
            httpStatus: 500
          }));
        } finally {
          // GUARANTEED LOCK CLEANUP - This will always execute
          if (lockAcquired) {
            try {
              const { data: releaseResult, error: releaseError } = await supabaseClient.rpc('release_order_lock', {
                p_order_id: orderId,
                p_admin_user_id: adminUserId
              });
              
              if (releaseError) {
                console.error(`❌ Failed to release lock [${correlationId}]:`, {
                  orderId,
                  adminUserId,
                  error: releaseError.message
                });
              } else if (releaseResult) {
                console.log(`✅ Lock released successfully for order ${orderId} [${correlationId}]`);
              } else {
                console.warn(`⚠️ Lock release returned false - may have expired [${correlationId}]:`, {
                  orderId,
                  adminSessionId
                });
              }
            } catch (lockReleaseError) {
              console.error(`❌ Critical error during lock release [${correlationId}]:`, {
                orderId,
                adminSessionId,
                error: lockReleaseError.message,
                stack: lockReleaseError.stack
              });
              
              // Log critical lock cleanup failure for monitoring
              try {
                await supabaseClient.from('audit_logs').insert([{
                  action: 'critical_lock_release_failure',
                  category: 'Critical System Error',
                  message: `Failed to release order lock: ${lockReleaseError.message}`,
                  entity_id: orderId,
                  new_values: {
                    orderId,
                    adminSessionId,
                    correlationId,
                    error: lockReleaseError.message,
                    timestamp: new Date().toISOString()
                  }
                }]);
              } catch (auditError) {
                console.error(`❌ Failed to log critical lock failure [${correlationId}]:`, auditError.message);
              }
            }
          }
        }
        
        // Background notification for status change using enhanced business logic
        if (sanitizedUpdates.status && sanitizedUpdates.status !== currentOrder.status) {
          try {
            // Use enhanced communication event function with business logic deduplication
            const { data: commResult } = await supabaseClient.rpc('upsert_communication_event_with_business_logic', {
              p_order_id: orderId,
              p_event_type: 'order_status_update',
              p_admin_session_id: adminUserId,
              p_template_key: getTemplateKey(sanitizedUpdates.status),
              p_template_variables: {
                customer_name: currentOrder.customer_name || 'Customer',
                order_number: currentOrder.order_number,
                status: sanitizedUpdates.status,
                order_id: orderId
              }
            });
            
            console.log(`📧 Enhanced communication event result [${correlationId}]:`, commResult);
            
            // Process notifications instantly (fire-and-forget)
            supabaseClient.functions.invoke('instant-email-processor', {
              body: { priority: 'high', limit: 5 }
            }).then(result => {
              console.log(`📧 Instant email processing result [${correlationId}]:`, result.data);
            }).catch(error => {
              console.error(`⚠️ Instant email processing failed (non-blocking) [${correlationId}]:`, error);
            });
          } catch (error) {
            console.error(`⚠️ Enhanced notification setup failed (non-blocking) [${correlationId}]:`, error);
          }
        }

        const result = {
          success: true,
          order: updatedOrder,
          message: 'Order updated successfully',
          correlationId,
          idempotency_key: idempotencyKey,
          locked_processing: lockAcquired,
          timestamp: new Date().toISOString()
        };

        // Cache successful result with enhanced function
        try {
          await supabaseClient.rpc('cache_idempotent_request_enhanced', {
            p_idempotency_key: idempotencyKey,
            p_request_data: { orderId, updates: sanitizedUpdates, adminUserId, correlationId },
            p_response_data: result,
            p_status: 'success',
            p_order_id: orderId,
            p_admin_user_id: adminUserId
          });
        } catch (cacheError) {
          console.error(`⚠️ Failed to cache result (non-blocking) [${correlationId}]:`, cacheError);
        }

        console.log(`✅ Order update completed successfully [${correlationId}]:`, { 
          orderId, 
          statusChanged: sanitizedUpdates.status !== currentOrder.status,
          newStatus: sanitizedUpdates.status,
          lockUsed: lockAcquired
        });

        return new Response(JSON.stringify(result), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId
          }
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
    // Enhanced Error Handling and Logging with Correlation ID
    const errorId = `admin-orders-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const errorDetails = {
      errorId,
      correlationId: correlationId || 'unknown',
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace',
      timestamp: new Date().toISOString(),
      requestMethod: req.method,
      requestHeaders: Object.fromEntries(req.headers.entries()),
      requestUrl: req.url
    };

    console.error(`❌ Admin orders manager critical error [${correlationId || 'unknown'}]:`, {
      ...errorDetails,
      // Sanitize sensitive headers for logging
      requestHeaders: {
        ...errorDetails.requestHeaders,
        authorization: errorDetails.requestHeaders.authorization ? '[REDACTED]' : undefined
      }
    });

    // Categorize error types for better monitoring and user feedback
    let errorCategory = 'UNKNOWN_ERROR';
    let httpStatus = 500;
    let userMessage = 'An unexpected error occurred. Please try again.';
    let retryAfter = null;

    if (error.message?.includes('duplicate key')) {
      errorCategory = 'DUPLICATE_KEY_ERROR';
      userMessage = 'This operation conflicts with existing data. Please refresh and try again.';
      httpStatus = 409;
      retryAfter = 3;
    } else if (error.message?.includes('foreign key')) {
      errorCategory = 'FOREIGN_KEY_ERROR';
      userMessage = 'Invalid reference to related data. Please check your input.';
      httpStatus = 400;
    } else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      errorCategory = 'NOT_FOUND_ERROR';
      httpStatus = 404;
      userMessage = 'The requested resource was not found.';
    } else if (error.message?.includes('permission') || error.message?.includes('access')) {
      errorCategory = 'PERMISSION_ERROR';
      httpStatus = 403;
      userMessage = 'You do not have permission to perform this action.';
    } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
      errorCategory = 'NETWORK_ERROR';
      httpStatus = 503;
      userMessage = 'Service temporarily unavailable. Please try again in a moment.';
      retryAfter = 10;
    } else if (error.message?.includes('lock') || error.message?.includes('concurrent')) {
      errorCategory = 'CONCURRENT_UPDATE_ERROR';
      httpStatus = 409;
      userMessage = 'Another admin is currently updating this order. Please wait and try again.';
      retryAfter = 5;
    }

    // Log to audit table for monitoring (non-blocking)
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'admin_orders_manager_error',
        category: 'Critical System Error',
        message: `Admin orders manager error: ${errorCategory}`,
        new_values: {
          errorId,
          correlationId: correlationId || 'unknown',
          errorCategory,
          message: error.message,
          stack: error.stack?.substring(0, 1000), // Limit stack trace length
          timestamp: new Date().toISOString(),
          httpStatus,
          userMessage
        }
      }]);
    } catch (auditError) {
      console.error(`⚠️ Failed to log error to audit table [${correlationId || 'unknown'}]:`, auditError.message);
    }

    const responseHeaders = { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'X-Error-ID': errorId,
      'X-Error-Category': errorCategory,
      'X-Correlation-ID': correlationId || 'unknown'
    };

    if (retryAfter) {
      responseHeaders['Retry-After'] = retryAfter.toString();
    }

    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      errorCode: errorCategory,
      errorId: errorId,
      correlationId: correlationId || 'unknown',
      timestamp: new Date().toISOString(),
      ...(retryAfter && { retryAfter }),
      // Include more details in development/debugging
      ...(Deno.env.get('ENVIRONMENT') === 'development' && {
        details: {
          originalError: error.message,
          stack: error.stack
        }
      })
    }), {
      status: httpStatus,
      headers: responseHeaders
    });
  }
});
