import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

// Import shared CORS with inline fallback for production stability
let getCorsHeaders: (origin?: string | null) => Record<string, string>;
let handleCorsPreflightResponse: (origin?: string | null) => Response;

try {
  const corsModule = await import('../_shared/cors.ts');
  getCorsHeaders = corsModule.getCorsHeaders;
  handleCorsPreflightResponse = corsModule.handleCorsPreflightResponse;
  console.log('✅ Loaded shared CORS module');
} catch (error) {
  console.warn('⚠️ Failed to load shared CORS, using inline fallback:', error);
  
  // Inline CORS fallback for production stability
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
  
  getCorsHeaders = (origin?: string | null) => {
    const baseHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'false'
    };
    
    if (!origin || (
      !FALLBACK_ALLOWED_ORIGINS.includes(origin) && 
      !DEV_PATTERNS.some(pattern => pattern.test(origin))
    )) {
      return { ...baseHeaders, 'Access-Control-Allow-Origin': '*' }; // Permissive fallback
    }
    
    return { ...baseHeaders, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
  };
  
  handleCorsPreflightResponse = (origin?: string | null) => {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  };
}

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const origin = req.headers.get('origin')
  
  console.log(`🚀 Admin Orders Manager: ${req.method} request from origin: ${origin}`)

  // Handle CORS preflight requests with proper 204 response
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request')
    return handleCorsPreflightResponse(origin)
  }

  const corsHeaders = getCorsHeaders(origin)

  // ✅ PRODUCTION-READY AUTHENTICATION
  // Since verify_jwt = true, Supabase automatically validates JWT and provides user context
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid authorization header')
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Missing authentication token',
        code: 'AUTH_TOKEN_MISSING'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // Get authenticated user from context (automatically validated by Supabase)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.log('❌ Authentication failed:', userError?.message || 'No user found')
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed. Please log in again.',
        code: 'AUTH_FAILED'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    console.log('✅ User authenticated:', user.id)

    // Check if user is admin using service role client for reliable access
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
      console.log('❌ User is not an active admin:', { 
        userId: user.id, 
        role: profile?.role, 
        isActive: profile?.is_active 
      })
      return new Response(JSON.stringify({
        success: false,
        error: 'Forbidden: Admin access required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      })
    }

    console.log('✅ Admin authentication successful for user:', user.id)
  } catch (authError) {
    console.error('❌ Authentication error:', authError)
    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }

  try {
    let { action, orderId, updates, riderId, page, pageSize, status, searchQuery, startDate, endDate, orderIds } = await req.json()
    
    // CRITICAL: Comprehensive phone field sanitization to prevent ALL column errors
    if (updates && typeof updates === 'object') {
      if ('phone' in updates) {
        console.log('🚨 GLOBAL SANITIZATION: Found phone field in updates, mapping to customer_phone');
        updates.customer_phone = updates.phone;
        delete updates.phone;
        console.log('✅ GLOBAL SANITIZED: Updates after phone field cleanup:', updates);
      }
    }

    switch (action) {
      case 'list': {
        console.log('Admin function: Listing orders', { page, pageSize, status, searchQuery, startDate, endDate })

        let query = supabaseClient
          .from('orders')
          .select(`*, 
            order_items (*),
            order_delivery_schedule (*),
            delivery_zones (id, name, base_fee, is_active)
          `, { count: 'exact' })
        // Sort by delivery date (today's orders first for confirmed status)
        if (status === 'confirmed') {
          query = query.order('order_time', { ascending: false })
        } else {
          query = query.order('order_time', { ascending: false })
        }

        // Filter based on status - for 'confirmed', only show paid orders
        if (status === 'confirmed') {
          query = query.eq('status', status).eq('payment_status', 'paid')
        } else if (status === 'all') {
          // Don't filter by status
        } else {
          query = query.eq('status', status)
        }

        if (searchQuery) {
          const searchString = `%${searchQuery}%`
          query = query.or(
            `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
          )
        }

        if (startDate && endDate) {
          query = query.gte('order_time', startDate).lte('order_time', endDate)
        }

        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        const { data, error, count } = await query.range(from, to)

        if (error) {
          console.error('Error fetching orders:', error)
          
          // Defensive fallback: try without embeds if embedding fails
          if (error.code === 'PGRST200' || error.message.includes('relationship')) {
            console.log('Retrying without embeds due to relationship error')
            
            let fallbackQuery = supabaseClient
              .from('orders')
              .select('*', { count: 'exact' })
              
            // Apply same filters
            if (status === 'confirmed') {
              fallbackQuery = fallbackQuery.eq('status', status).eq('payment_status', 'paid')
            } else if (status !== 'all') {
              fallbackQuery = fallbackQuery.eq('status', status)
            }

            if (searchQuery) {
              const searchString = `%${searchQuery}%`
              fallbackQuery = fallbackQuery.or(
                `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
              )
            }

            if (startDate && endDate) {
              fallbackQuery = fallbackQuery.gte('order_time', startDate).lte('order_time', endDate)
            }

            fallbackQuery = fallbackQuery.order('order_time', { ascending: false })
            const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery.range(from, to)
            
            if (fallbackError) {
              return new Response(JSON.stringify({
                success: false,
                error: fallbackError.message
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
              })
            }

            // Fetch related data separately
            const orderIds = fallbackData?.map(order => order.id) || []
            
            const [itemsResult, schedulesResult, zonesResult] = await Promise.all([
              supabaseClient.from('order_items').select('*').in('order_id', orderIds),
              supabaseClient.from('order_delivery_schedule').select('*').in('order_id', orderIds),
              supabaseClient.from('delivery_zones').select('id, name, base_fee, is_active')
            ])

            // Merge the data
            const enrichedOrders = fallbackData?.map(order => ({
              ...order,
              order_items: itemsResult.data?.filter(item => item.order_id === order.id) || [],
              order_delivery_schedule: schedulesResult.data?.filter(schedule => schedule.order_id === order.id) || [],
              delivery_zones: zonesResult.data?.find(zone => zone.id === order.delivery_zone_id) || null
            }))

            return new Response(JSON.stringify({
              success: true,
              orders: enrichedOrders,
              count: fallbackCount || 0
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        return new Response(JSON.stringify({
          success: true,
          orders: data,
          count: count || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
        break
      }

      case 'assign_rider': {
        console.log('🎯 Admin function: Assigning rider', riderId, 'to order', orderId)
        
        // Get order status to determine which RPC to use
        const { data: orderCheck, error: orderCheckError } = await supabaseClient
          .from('orders')
          .select('id, status, order_number')
          .eq('id', orderId)
          .single()

        if (orderCheckError || !orderCheck) {
          console.error('❌ Order not found:', orderId, orderCheckError)
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        // Use appropriate RPC based on order status
        if (['confirmed', 'preparing', 'ready'].includes(orderCheck.status)) {
          // Use start_delivery for new assignments
          console.log('🚀 Using start_delivery RPC for order in status:', orderCheck.status)
          
          const { data: result, error: rpcError } = await supabaseClient
            .rpc('start_delivery', {
              p_order_id: orderId,
              p_rider_id: riderId
            })

          if (rpcError) {
            console.error('❌ start_delivery RPC failed:', rpcError)
            return new Response(JSON.stringify({
              success: false,
              error: rpcError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            })
          }

          console.log('✅ Order started for delivery successfully')
          
          // Fetch updated order with relations
          const { data: updatedOrder, error: fetchError } = await supabaseClient
            .from('orders')
            .select(`*, 
              order_items (*),
              order_delivery_schedule (*),
              delivery_zones (id, name, base_fee, is_active)
            `)
            .eq('id', orderId)
            .single()

          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Order ${orderCheck.order_number} started for delivery`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })

        } else if (orderCheck.status === 'out_for_delivery') {
          // Use reassign_order_rider for reassignments
          console.log('🔄 Using reassign_order_rider RPC for order in status:', orderCheck.status)
          
          const { data: result, error: rpcError } = await supabaseClient
            .rpc('reassign_order_rider', {
              p_order_id: orderId,
              p_new_rider_id: riderId,
              p_reason: 'Admin reassignment via dashboard'
            })

          if (rpcError) {
            console.error('❌ reassign_order_rider RPC failed:', rpcError)
            return new Response(JSON.stringify({
              success: false,
              error: rpcError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            })
          }

          console.log('✅ Rider reassigned successfully')
          
          // Fetch updated order with relations
          const { data: updatedOrder, error: fetchError } = await supabaseClient
            .from('orders')
            .select(`*, 
              order_items (*),
              order_delivery_schedule (*),
              delivery_zones (id, name, base_fee, is_active)
            `)
            .eq('id', orderId)
            .single()

          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Rider reassigned for order ${orderCheck.order_number}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })

        } else {
          console.error('❌ Order not in assignable or reassignable status:', orderCheck.status)
          return new Response(JSON.stringify({
            success: false,
            error: `Order ${orderCheck.order_number} cannot have rider assigned in status: ${orderCheck.status}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }
      }

      case 'update': {
        console.log('Admin function: Updating order', orderId, 'with updates:', JSON.stringify(updates))

        // Get the current order to compare status changes
        const { data: currentOrder, error: fetchError } = await supabaseClient
          .from('orders')
          .select('status, customer_email, customer_name, order_number')
          .eq('id', orderId)
          .single()

        if (fetchError) {
          console.error('Error fetching current order:', fetchError)
          return new Response(JSON.stringify({
            success: false,
            error: fetchError.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        // SECURITY: Strict whitelist of allowed columns for order updates
        const allowedColumns = [
          'status', 'customer_name', 'customer_phone', 'customer_email',
          'delivery_address', 'delivery_instructions', 'order_notes',
          'assigned_rider_id', 'payment_status', 'total_amount',
          'delivery_zone_id', 'order_type', 'special_instructions',
          'internal_notes', 'updated_at'
        ];

        // Sanitize and validate updates
        const sanitizedUpdates = {};
        console.log('Raw updates before sanitization:', updates);
        
        if (updates && typeof updates === 'object') {
          for (const [key, value] of Object.entries(updates)) {
            if (key === 'phone') {
              // Map legacy phone field to customer_phone
              console.log('🔧 Mapping phone to customer_phone:', value);
              sanitizedUpdates.customer_phone = value;
            } else if (allowedColumns.includes(key)) {
              sanitizedUpdates[key] = value;
            } else {
              console.warn(`⚠️ Blocked unauthorized column update attempt: ${key}`);
            }
          }
        }

        // Ensure we always set updated_at for tracking
        sanitizedUpdates.updated_at = new Date().toISOString();
        
        console.log('Sanitized and whitelisted updates:', sanitizedUpdates);

        const { data, error } = await supabaseClient
          .from('orders')
          .update(sanitizedUpdates)
          .eq('id', orderId)
          .select(`*, 
            order_items (*),
            delivery_zones (id, name, base_fee, is_active),
            order_delivery_schedule (*)
          `)
          .single()

        if (error) {
          console.error('Error updating order:', error)
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        // Trigger status change email if status has changed and customer has email
        if (updates.status && updates.status !== currentOrder.status && data.customer_email) {
          console.log('📧 Status changed, queuing email notification...')
          
          // Queue communication event with improved error handling and unique key generation
          try {
            // Generate truly unique dedupe key to prevent collisions
            const uniqueId = crypto.randomUUID();
            const timestamp = Date.now();
            const microTime = performance.now().toString().replace('.', '');
            
            const { data: eventId, error: commError } = await supabaseClient
              .rpc('upsert_communication_event', {
                p_event_type: 'order_status_update',
                p_recipient_email: data.customer_email,
                p_recipient_name: data.customer_name || 'Customer',
                p_template_key: 'order_status_update',
                p_template_variables: {
                  orderNumber: data.order_number,
                  newStatus: updates.status,
                  customerName: data.customer_name,
                  orderDate: data.order_time
                },
                p_related_order_id: orderId,
                p_dedupe_key: `order_status_${orderId}_${updates.status}_${timestamp}_${microTime}_${uniqueId}`
              })

            if (commError) {
              console.error('⚠️ Failed to queue communication event:', commError.message || commError)
              
              // Log the failure but don't block order update
              console.log('📝 Logging communication event failure to audit logs')
              try {
                await supabaseClient
                  .from('audit_logs')
                  .insert({
                    action: 'communication_event_failed',
                    category: 'Email System',
                    message: `Failed to queue status update email for order ${data.order_number}: ${commError.message}`,
                    entity_id: orderId,
                    new_values: {
                      order_id: orderId,
                      order_number: data.order_number,
                      new_status: updates.status,
                      old_status: currentOrder.status,
                      customer_email: data.customer_email,
                      error: commError.message || 'Unknown error'
                    }
                  })
              } catch (logError) {
                console.error('⚠️ Failed to log communication error:', logError)
              }
            } else {
              console.log('✅ Communication event queued successfully with ID:', eventId)
            }
          } catch (commError) {
            console.error('⚠️ Unexpected error queuing communication event:', commError)
            
            // Log unexpected errors for debugging
            try {
              await supabaseClient
                .from('audit_logs')
                .insert({
                  action: 'communication_event_exception',
                  category: 'Email System',
                  message: `Unexpected error queuing status update email for order ${data.order_number}`,
                  entity_id: orderId,
                  new_values: {
                    order_id: orderId,
                    order_number: data.order_number,
                    error: commError.message || 'Unexpected error',
                    stack: commError.stack || 'No stack trace'
                  }
                })
            } catch (logError) {
              console.error('⚠️ Failed to log unexpected communication error:', logError)
            }
          }
        } else if (updates.status && updates.status !== currentOrder.status && !data.customer_email) {
          console.log('⚠️ Status changed but no customer email available for notification')
        }

        return new Response(JSON.stringify({
          success: true,
          order: data,
          message: `Order ${data.order_number} updated successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
        break
      }

      case 'delete': {
        console.log('Admin function: Deleting order', orderId)

        // Delete related records to avoid foreign key constraints
        const deleteOperations = [
          supabaseClient.from('order_items').delete().eq('order_id', orderId),
          supabaseClient.from('order_delivery_schedule').delete().eq('order_id', orderId),
          supabaseClient.from('order_status_changes').delete().eq('order_id', orderId),
          supabaseClient.from('communication_events').delete().eq('order_id', orderId)
        ]

        try {
          await Promise.all(deleteOperations)
        } catch (relatedError) {
          console.warn('⚠️ Some related record deletions failed (non-blocking):', relatedError)
        }

        const { data, error } = await supabaseClient
          .from('orders')
          .delete()
          .eq('id', orderId)

        if (error) {
          console.error('Error deleting order:', error)
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Order deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
        break
      }

      case 'bulk_delete': {
        console.log('Admin function: Bulk deleting orders', orderIds)

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid order IDs provided'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        // Delete related records for all orders
        const deleteOperations = [
          supabaseClient.from('order_items').delete().in('order_id', orderIds),
          supabaseClient.from('order_delivery_schedule').delete().in('order_id', orderIds),
          supabaseClient.from('order_status_changes').delete().in('order_id', orderIds),
          supabaseClient.from('communication_events').delete().in('order_id', orderIds)
        ]

        try {
          await Promise.all(deleteOperations)
        } catch (relatedError) {
          console.warn('⚠️ Some related record deletions failed (non-blocking):', relatedError)
        }

        const { data, error } = await supabaseClient
          .from('orders')
          .delete()
          .in('id', orderIds)

        if (error) {
          console.error('Error bulk deleting orders:', error)
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        return new Response(JSON.stringify({
          success: true,
          message: `${orderIds.length} orders deleted successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
        break
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
    }

  } catch (error) {
    console.error('❌ Admin orders manager error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})