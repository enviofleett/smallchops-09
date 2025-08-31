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
    const { action, orderId, updates, riderId, page, pageSize, status, searchQuery, startDate, endDate, orderIds } = await req.json()

    switch (action) {
      case 'list': {
        console.log('Admin function: Listing orders', { page, pageSize, status, searchQuery, startDate, endDate })

        let query = supabaseClient
          .from('orders_view')
          .select(`*, 
            order_items (*),
            order_delivery_schedule (*)
          `, { count: 'exact' })
          .order('order_time', { ascending: false })

        if (status !== 'all') {
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
        
        // Validate rider exists and is active
        const { data: rider, error: riderError } = await supabaseClient
          .from('drivers')
          .select('id, name, is_active')
          .eq('id', riderId)
          .single()

        if (riderError || !rider) {
          console.error('❌ Invalid rider ID:', riderId, riderError)
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid rider ID: ${riderId}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        if (!rider.is_active) {
          console.error('❌ Rider is not active:', riderId)
          return new Response(JSON.stringify({
            success: false,
            error: `Rider ${rider.name} is not active`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        // Validate order exists and is assignable
        const { data: order, error: orderError } = await supabaseClient
          .from('orders')
          .select('id, status, order_number')
          .eq('id', orderId)
          .single()

        if (orderError || !order) {
          console.error('❌ Invalid order ID:', orderId, orderError)
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        if (!['confirmed', 'preparing', 'ready'].includes(order.status)) {
          console.error('❌ Order not in assignable status:', order.status)
          return new Response(JSON.stringify({
            success: false,
            error: `Order ${order.order_number} is not in assignable status (current: ${order.status})`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          })
        }

        // Perform the assignment with transaction safety
        const { data: updatedOrder, error: updateError } = await supabaseClient
          .from('orders')
          .update({ 
            assigned_rider_id: riderId,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .select(`*, 
            order_items (*),
            delivery_zones (id, name, base_fee, is_active),
            order_delivery_schedule (*)
          `)
          .single()

        if (updateError) {
          console.error('❌ Failed to assign rider:', updateError)
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to assign rider: ${updateError.message}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          })
        }

        console.log('✅ Rider assigned successfully:', rider.name, 'to order', order.order_number)

        return new Response(JSON.stringify({
          success: true,
          order: updatedOrder,
          message: `Rider ${rider.name} assigned to order ${order.order_number}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'update': {
        console.log('Admin function: Updating order', orderId, updates)

        const { data, error } = await supabaseClient
          .from('orders')
          .update(updates)
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
