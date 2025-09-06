import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { getCorsHeaders } from '../_shared/cors.ts'

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  console.log(`🌐 Request from origin: ${origin || 'none'}`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    let { action, orderId, updates, riderId, page, pageSize, status, searchQuery, startDate, endDate, orderIds } = await req.json()
    
    // CRITICAL: Sanitize any phone fields that come through to prevent column errors
    if (updates && typeof updates === 'object' && 'phone' in updates) {
      console.log('🚨 SANITIZING: Found phone field in updates, mapping to customer_phone');
      updates.customer_phone = updates.phone;
      delete updates.phone;
      console.log('✅ SANITIZED: Updates after phone field cleanup:', updates);
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

        // Sanitize updates: map 'phone' to 'customer_phone' for orders table
        const sanitizedUpdates = { ...(updates || {}) };
        console.log('Raw updates before sanitization:', sanitizedUpdates);
        
        if (sanitizedUpdates && 'phone' in sanitizedUpdates) {
          console.log('Found phone field, mapping to customer_phone:', sanitizedUpdates.phone);
          sanitizedUpdates.customer_phone = sanitizedUpdates.phone;
          delete sanitizedUpdates.phone;
        }
        
        console.log('Sanitized updates:', sanitizedUpdates);
        
        // FINAL SAFETY CHECK: Ensure no phone field exists before DB update
        if ('phone' in sanitizedUpdates) {
          console.error('🚨 CRITICAL: Phone field still exists after sanitization!');
          delete sanitizedUpdates.phone;
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
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        // Trigger status change email if status has changed and customer has email
        if (updates.status && updates.status !== currentOrder.status && currentOrder.customer_email) {
          try {
            console.log(`Triggering status change email: ${currentOrder.status} -> ${updates.status}`)
            
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
            
            const { error: emailError } = await supabaseClient.functions.invoke('user-journey-automation', {
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
                  updated_at: new Date().toISOString()
                }
              },
              headers: {
                'x-internal-secret': signatureHex,
                'x-timestamp': timestamp
              }
            })

            if (emailError) {
              console.error('Failed to trigger status change email:', emailError)
              // Don't fail the order update if email fails
            } else {
              console.log('✅ Status change email triggered successfully')
            }
          } catch (emailError) {
            console.error('Error triggering status change email:', emailError)
            // Don't fail the order update if email fails
          }
        }

        return new Response(JSON.stringify({
          success: true,
          order: data
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
        break
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
        break
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
