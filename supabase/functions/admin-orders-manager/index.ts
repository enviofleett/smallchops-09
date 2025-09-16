import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { OrderManagerErrorHandler, createErrorResponse } from './error-handler.ts'

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

// Initialize error handler for emergency stabilization
const errorHandler = new OrderManagerErrorHandler({
  maxRetries: 3,
  retryDelayMs: 1000,
  circuitBreakerThreshold: 5,
  timeoutMs: 30000
});

serve(async (req) => {
  const origin = req.headers.get('origin')
  
  console.log(`🚀 Admin Orders Manager: ${req.method} request from origin: ${origin}`)

  // Handle CORS preflight requests with proper 204 response
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request')
    return handleCorsPreflightResponse(origin)
  }

  const corsHeaders = getCorsHeaders(origin)

  // ADMIN AUTHENTICATION: Validate JWT and admin role manually since verify_jwt = false
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid authorization header')
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Missing authentication token'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.log('❌ Invalid JWT token:', authError?.message)
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid authentication token'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // Check if user is admin
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

        // CRITICAL FIX: Properly handle undefined status to prevent enum violations
        if (status === 'confirmed') {
          query = query.eq('status', status).eq('payment_status', 'paid')
        } else if (status === 'all' || status === undefined || status === null) {
          // Don't filter by status for 'all', undefined, or null
          console.log('🔍 No status filter applied (status:', status, ')')
        } else if (typeof status === 'string' && status.trim() !== '') {
          // Only apply status filter for valid non-empty strings
          query = query.eq('status', status.trim())
        } else {
          console.warn('⚠️ Invalid status value received:', status, 'Skipping status filter')
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
          return createErrorResponse(errorHandler, error, 'fetch_orders', corsHeaders)
        }

        return new Response(JSON.stringify({
          success: true,
          orders: data,
          count: count || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
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

        // Enhanced sanitization and validation with comprehensive field cleaning
        const sanitizedUpdates = {};
        const rejectedFields = [];
        console.log('🔍 Raw updates before enhanced sanitization:', updates);
        
        if (updates && typeof updates === 'object') {
          for (const [key, value] of Object.entries(updates)) {
            // Skip null or undefined values for non-critical fields
            if ((value === null || value === undefined) && key !== 'assigned_rider_id') {
              console.warn(`⚠️ Skipping null/undefined field: ${key} with value:`, value);
              rejectedFields.push(`${key} (null/undefined)`);
              continue;
            }

            if (key === 'phone') {
              // Map legacy phone field to customer_phone
              console.log('🔧 Mapping phone to customer_phone:', value);
              if (value && value.trim() !== '') {
                sanitizedUpdates.customer_phone = value;
              } else {
                rejectedFields.push(`${key} -> customer_phone (empty value)`);
              }
            } else if (key === 'assigned_rider_id') {
              // Special handling for rider assignment - allow null to unassign
              if (value === null || value === '') {
                console.log('🔧 Allowing null assigned_rider_id to unassign rider');
                sanitizedUpdates[key] = null;
              } else if (typeof value === 'string' && value.length > 0) {
                sanitizedUpdates[key] = value;
              } else {
                console.warn(`⚠️ Invalid assigned_rider_id value:`, value);
                rejectedFields.push(`${key} (invalid format)`);
              }
            } else if (allowedColumns.includes(key)) {
              // Standard field validation
              if (typeof value === 'string' && value.trim() === '') {
                console.warn(`⚠️ Skipping empty string for field: ${key}`);
                rejectedFields.push(`${key} (empty string)`);
              } else {
                sanitizedUpdates[key] = value;
              }
            } else {
              console.warn(`⚠️ Blocked unauthorized column update attempt: ${key}`);
              rejectedFields.push(`${key} (unauthorized)`);
            }
          }
        }

        // Always set updated_at for audit trail
        sanitizedUpdates.updated_at = new Date().toISOString();
        
        console.log('✅ ENHANCED SANITIZATION: Final updates after cleaning:', sanitizedUpdates);
        console.log('⚠️ ENHANCED SANITIZATION: Rejected fields:', rejectedFields);

        // CRITICAL FIX: Check if there are any meaningful updates (excluding just updated_at)
        const meaningfulUpdates = { ...sanitizedUpdates };
        delete meaningfulUpdates.updated_at;
        
        if (Object.keys(meaningfulUpdates).length === 0) {
          console.error('❌ No valid updates after enhanced cleaning. Rejected fields:', rejectedFields);
          return new Response(JSON.stringify({
            success: false,
            error: 'No valid fields to update. All provided fields were filtered out for security or validation reasons.',
            details: {
              rejected_fields: rejectedFields,
              allowed_fields: allowedColumns,
              message: 'Please ensure you are sending valid, non-empty values for allowed fields only.'
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

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
          return createErrorResponse(errorHandler, error, 'update_order', corsHeaders)
        }

        // 🎯 PRODUCTION-READY: Queue communication event for status change with robust handling
        if (updates.status && updates.status !== currentOrder.status && currentOrder.customer_email) {
          try {
            console.log(`📧 Triggering status change email: ${currentOrder.status} -> ${updates.status}`)
            
            // Import communication utilities for robust handling
            const { upsertCommunicationEventSafe } = await import('../_shared/communication-utils.ts');
            
            // Create communication event with robust duplicate prevention
            const eventResult = await upsertCommunicationEventSafe(supabaseClient, {
              event_type: 'order_status_update',
              recipient_email: currentOrder.customer_email,
              template_key: `order_status_${updates.status}`,
              template_variables: {
                customer_name: currentOrder.customer_name || 'Customer',
                order_number: currentOrder.order_number,
                status: updates.status,
                old_status: currentOrder.status,
                updated_at: new Date().toISOString()
              },
              order_id: orderId,
              priority: 'normal'
            });
            
            if (eventResult.success) {
              console.log('✅ Communication event created successfully:', {
                event_id: eventResult.event_id,
                attempts: eventResult.attempts,
                isDuplicate: eventResult.isDuplicate
              });
            } else {
              console.error('❌ Failed to create communication event:', eventResult.error);
              
              // Fallback: Use user-journey-automation as backup
              console.log('🔄 Attempting fallback via user-journey-automation...');
              
              // Create HMAC signature for internal authentication
              const timestamp = Math.floor(Date.now() / 1000).toString()
              const message = `${timestamp}:user-journey-automation`
              const secret = Deno.env.get('UJ_INTERNAL_SECRET') || 'fallback-secret-key'
              
              const encoder = new TextEncoder()
              const keyData = await crypto.subtle.importKey(
                'raw',
                encoder.encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
              )
              
              const signature = await crypto.subtle.sign(
                'HMAC',
                keyData,
                encoder.encode(message)
              )
              
              const signatureHex = Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
              
              const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('user-journey-automation', {
                body: {
                  journey_type: 'order_status_change',
                  user_data: {
                    email: currentOrder.customer_email,
                    name: currentOrder.customer_name
                  },
                  order_data: {
                    order_id: orderId,
                    order_number: currentOrder.order_number,
                    status: updates.status
                  },
                  metadata: {
                    old_status: currentOrder.status,
                    new_status: updates.status,
                    updated_at: new Date().toISOString(),
                    admin_triggered: true,
                    request_id: crypto.randomUUID()
                  }
                },
                headers: {
                  'x-internal-secret': signatureHex,
                  'x-timestamp': timestamp
                }
              })

              if (emailError) {
                console.error('❌ Fallback user-journey-automation also failed:', emailError)
                // Log for monitoring but don't fail the order update
                await supabaseClient
                  .from('audit_logs')
                  .insert({
                    action: 'all_email_methods_failed',
                    category: 'Email System',
                    message: `All email methods failed for order ${currentOrder.order_number}`,
                  entity_id: orderId,
                  new_values: {
                    order_id: orderId,
                    old_status: currentOrder.status,
                    new_status: updates.status,
                    error: emailError.message
                  }
                });
            } else {
              console.log('✅ Status change email triggered successfully');
              if (emailResult?.email_events_created > 0) {
                console.log(`📧 Created ${emailResult.email_events_created} email events`);
              }
            }
          } catch (emailError) {
            console.error('❌ Exception triggering status change email:', emailError)
            // Continue with order update even if email fails
          }
        }

        return new Response(JSON.stringify({
          success: true,
          order: data
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'delete': {
        console.log('Admin function: Deleting order', orderId)

        const { error } = await supabaseClient
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
      }

      case 'bulk_delete': {
        console.log('Admin function: Bulk deleting orders', orderIds)

        const { error } = await supabaseClient
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
          message: 'Orders deleted successfully'
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
