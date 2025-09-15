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

  // ✅ FIXED AUTHENTICATION - Proper JWT handling
  try {
    const authHeader = req.headers.get('authorization')
    console.log('🔍 Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.log('❌ No authorization header provided')
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: No authentication token provided',
        code: 'AUTH_TOKEN_MISSING'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid authorization header format')
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid token format',
        code: 'AUTH_TOKEN_INVALID_FORMAT'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // Extract JWT token
    const jwt = authHeader.replace('Bearer ', '')
    console.log('🔍 JWT token extracted, length:', jwt.length)
    
    // Use service role client with auth header to verify JWT
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get user from the JWT token
    const { data: { user }, error: userError } = await authClient.auth.getUser(jwt)
    
    console.log('🔍 User verification result:', { 
      hasUser: !!user, 
      userId: user?.id, 
      userEmail: user?.email,
      error: userError?.message 
    })
    
    if (userError) {
      console.log('❌ JWT verification failed:', userError.message)
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired token. Please log in again.',
        code: 'AUTH_TOKEN_INVALID'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }
    
    if (!user) {
      console.log('❌ No user found in valid JWT')
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed. Please log in again.',
        code: 'AUTH_USER_NOT_FOUND'
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
        isActive: profile?.is_active,
        profileError: profileError?.message
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
    
    // CRITICAL: Comprehensive field sanitization to prevent ALL enum/column errors
    if (updates && typeof updates === 'object') {
      // Phone field mapping
      if ('phone' in updates) {
        console.log('🚨 GLOBAL SANITIZATION: Found phone field in updates, mapping to customer_phone');
        updates.customer_phone = updates.phone;
        delete updates.phone;
      }
      
      // CRITICAL: Status field validation at entry point
      if ('status' in updates) {
        if (!updates.status || 
            updates.status === 'undefined' || 
            updates.status === 'null' || 
            typeof updates.status !== 'string' ||
            updates.status.trim() === '') {
          console.error('❌ ENTRY POINT BLOCKED: Invalid status in request body:', updates.status);
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid status in request: ${updates.status}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
      }
      
      console.log('✅ GLOBAL SANITIZATION: Updates after field cleanup:', updates);
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

        // Validate required parameters
        if (!orderId) {
          console.error('❌ Missing orderId parameter')
          return new Response(JSON.stringify({
            success: false,
            error: 'Order ID is required'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        if (!updates || Object.keys(updates).length === 0) {
          console.error('❌ No updates provided')
          return new Response(JSON.stringify({
            success: false,
            error: 'Updates are required'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        // If it's a status update, use the safe database function
        if (updates && updates.status && Object.keys(updates).length === 1) {
          console.log('🔄 Using safe database function for status update:', updates.status)
          
          // CRITICAL: Comprehensive status validation
          if (!updates.status || 
              updates.status === 'undefined' || 
              updates.status === 'null' || 
              typeof updates.status !== 'string' ||
              updates.status.trim() === '') {
            console.error('❌ BLOCKED: Invalid status value:', updates.status, 'Type:', typeof updates.status)
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid status value: ${updates.status}. Status must be a valid non-empty string.`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            })
          }

          // Validate against allowed enum values
          const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
          if (!validStatuses.includes(updates.status)) {
            console.error('❌ BLOCKED: Status not in allowed enum values:', updates.status)
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid status: ${updates.status}. Valid statuses are: ${validStatuses.join(', ')}`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            })
          }

          console.log('✅ Status validation passed in Edge Function:', updates.status)

          try {
            // Use enhanced version with better validation
            const { data: result, error: dbError } = await supabaseClient.rpc('admin_safe_update_order_status_enhanced', {
              p_order_id: orderId,
              p_new_status: updates.status,
              p_admin_id: null // We could pass the authenticated user ID here if needed
            })

            if (dbError) {
              console.error('❌ Enhanced safe update function error:', dbError)
              return new Response(JSON.stringify({
                success: false,
                error: `Database error: ${dbError.message}`,
                code: 'DATABASE_ERROR'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
              })
            }

            if (!result) {
              console.error('❌ No result from enhanced safe update function')
              return new Response(JSON.stringify({
                success: false,
                error: 'No result from database function'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
              })
            }

            console.log('✅ Enhanced safe update result:', result)

            if (!result.success) {
              return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
              })
            }

            return new Response(JSON.stringify({
              success: true,
              message: 'Order status updated successfully',
              order: result.order
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          } catch (functionError) {
            console.error('❌ Exception in enhanced safe update function:', functionError)
            return new Response(JSON.stringify({
              success: false,
              error: `Status update failed: ${functionError.message}`,
              code: 'STATUS_UPDATE_FAILED'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            })
          }
      } else {
        // For other field updates (non-status), use direct table update with enhanced validation
        console.log('🔄 Using direct table update for non-status fields with enhanced validation')
        
        // Enhanced validation - clean and validate updates
        const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
          // Skip null, undefined, empty string, or string representations of these
          if (value !== undefined && 
              value !== null && 
              value !== 'undefined' && 
              value !== 'null' && 
              value !== '') {
            
            // Additional validation for specific fields
            if (key === 'status') {
              // Should not reach here since status updates go through the enhanced function
              console.warn('⚠️ Status update detected in non-status path - skipping');
              return acc;
            }
            
            if (key === 'customer_phone' && typeof value === 'string') {
              // Clean phone number format
              acc[key] = value.trim();
            } else if (key === 'customer_email' && typeof value === 'string') {
              // Clean email format
              acc[key] = value.toLowerCase().trim();
            } else {
              acc[key] = value;
            }
          } else {
            console.warn(`⚠️ Skipping invalid field ${key} with value:`, value);
          }
          return acc;
        }, {} as Record<string, any>);

        if (Object.keys(cleanUpdates).length === 0) {
          console.error('❌ No valid updates after enhanced cleaning')
          return new Response(JSON.stringify({
            success: false,
            error: 'No valid updates provided after validation'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        try {
          console.log('🔄 Applying clean updates:', cleanUpdates);
          
          const { data: updatedOrder, error: updateError } = await supabaseClient
            .from('orders')
            .update({
              ...cleanUpdates,
              updated_at: new Date().toISOString() // Ensure updated_at is always set
            })
            .eq('id', orderId)
            .select(`*, 
              order_items (*),
              order_delivery_schedule (*),
              delivery_zones (id, name, base_fee, is_active)
            `)
            .single()

          if (updateError) {
            console.error('❌ Enhanced direct update error:', updateError)
            
            // Provide more specific error messages
            let errorMessage = updateError.message;
            if (updateError.code === '23505') {
              errorMessage = 'Update failed due to duplicate data constraint';
            } else if (updateError.code === '23503') {
              errorMessage = 'Update failed due to invalid reference data';
            } else if (updateError.code === '22P02') {
              errorMessage = 'Update failed due to invalid data format';
            }
            
            return new Response(JSON.stringify({
              success: false,
              error: errorMessage,
              code: 'UPDATE_FAILED',
              details: updateError.code
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            })
          }

          console.log('✅ Order updated successfully via enhanced direct update')

          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: 'Order updated successfully'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (directUpdateError) {
          console.error('❌ Exception in enhanced direct update:', directUpdateError)
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to update order: ' + directUpdateError.message,
            code: 'DIRECT_UPDATE_EXCEPTION'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }
        }
        break;
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