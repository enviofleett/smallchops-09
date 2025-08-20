import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts'

serve(async (req) => {
  const cors = getCorsHeaders(req)
  const pre = handleCorsPreflight(req)
  if (pre) return new Response(null, { status: 204, headers: cors })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('📦 [PROCESS-CHECKOUT] Processing checkout request:', {
      items_count: body.items?.length,
      customer_email: body.customer?.email,
      delivery_zone_id: body.delivery?.zone_id
    })

    // Extract data from the request body
    const { customer, items, delivery, cartId } = body;

    // Basic validation
    if (!customer || !items || !delivery || !cartId) {
      throw new Error('Missing required fields in request body');
    }

    // Calculate total amount from items
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create order in database
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
        total_amount: totalAmount,
        delivery_zone_id: delivery.zone_id,
        delivery_fee: delivery.fee,
        order_items: items,
        cart_id: cartId,
        status: 'pending',
        payment_status: 'pending',
        order_time: new Date().toISOString(),
      })
      .select('id, order_number, total_amount, delivery_fee')
      .single();

    if (orderError) {
      console.error('❌ [PROCESS-CHECKOUT] Order creation failed:', orderError);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    // PATCH: stop passing amount/reference; let server compute
    const { data: paymentData, error: paymentError } = await supabaseClient.functions.invoke("secure-payment-processor", {
      body: {
        action: "initialize",
        order_id: order.id,
        customer_email: body.customer.email,
      },
    })

    if (paymentError) {
      console.error('❌ [PROCESS-CHECKOUT] Payment initialization failed:', paymentError)
      throw new Error(`Payment initialization failed: ${paymentError.message}`)
    }

    if (!paymentData?.success) {
      console.error('❌ [PROCESS-CHECKOUT] Payment processor returned error:', paymentData)
      throw new Error(paymentData?.error || 'Payment initialization failed')
    }

    console.log('✅ [PROCESS-CHECKOUT] Payment initialized:', {
      order_id: order.id,
      reference: paymentData.reference,
      amount: paymentData.amount,
      mode: paymentData.mode
    })

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          delivery_fee: order.delivery_fee
        },
        payment: {
          authorization_url: paymentData.authorization_url,
          reference: paymentData.reference,
          amount: paymentData.amount,
          mode: paymentData.mode
        }
      }),
      { 
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ [PROCESS-CHECKOUT] Error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Checkout processing failed'
      }),
      { 
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      }
    )
  }
})
