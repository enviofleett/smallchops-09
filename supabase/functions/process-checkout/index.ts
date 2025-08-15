// process-checkout/index.ts - Updated with constraint fix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestData = await req.json()
    const { orderId, fulfillmentType } = requestData

    if (!orderId) {
      throw new Error('Order ID is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[PROCESS-CHECKOUT] Processing order: ${orderId}, fulfillment: ${fulfillmentType}`)

    // Step 1: Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[PROCESS-CHECKOUT] Order not found:', orderError)
      throw new Error('Order not found')
    }

    console.log('[PROCESS-CHECKOUT] Order found:', {
      id: order.id,
      status: order.status,
      fulfillment_type: order.order_type,
      existing_payment_reference: order.payment_reference
    })

    // Step 2: Generate payment reference with txn_ prefix (NEVER pay_)
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 15)
    const authoritativePaymentReference = `txn_${timestamp}_${randomSuffix}`

    console.log('[PROCESS-CHECKOUT] Generated reference:', authoritativePaymentReference)

    // Step 3: Update order with payment reference using the new function
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_order_with_payment_reference', {
        order_uuid: orderId,
        new_payment_reference: authoritativePaymentReference,
        order_fulfillment_type: fulfillmentType || order.order_type
      })

    if (updateError) {
      console.error('[PROCESS-CHECKOUT] Failed to update payment reference:', updateError)
      throw new Error(`Failed to update payment reference: ${updateError.message}`)
    }

    console.log('[PROCESS-CHECKOUT] Payment reference updated:', updateResult)

    // Step 4: Initialize Paystack payment
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured')
    }

    const paystackInitData = {
      email: order.customer_email,
      amount: Math.round(order.total_amount * 100), // Convert to kobo
      reference: authoritativePaymentReference,
      callback_url: `${req.headers.get('origin') || 'https://startersmallchops.com'}/payment/callback?reference=${authoritativePaymentReference}`,
      metadata: {
        order_id: orderId,
        fulfillment_type: fulfillmentType || order.order_type,
        customer_phone: order.customer_phone,
        delivery_address: order.delivery_address
      }
    }

    console.log('[PROCESS-CHECKOUT] Initializing Paystack payment:', {
      reference: authoritativePaymentReference,
      amount: paystackInitData.amount,
      email: order.customer_email
    })

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackInitData)
    })

    const paystackResult = await paystackResponse.json()

    if (!paystackResponse.ok || !paystackResult.status) {
      console.error('[PROCESS-CHECKOUT] Paystack initialization failed:', paystackResult)
      throw new Error(`Paystack error: ${paystackResult.message || 'Payment initialization failed'}`)
    }

    console.log('[PROCESS-CHECKOUT] Paystack payment initialized successfully')

    // Step 5: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paystackResult.data.authorization_url,
        reference: authoritativePaymentReference,
        order: {
          id: order.id,
          order_number: order.order_number,
          amount: order.total_amount,
          fulfillment_type: fulfillmentType || order.order_type
        }
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )

  } catch (error) {
    console.error('[PROCESS-CHECKOUT] Error:', error.message)
    console.error('[PROCESS-CHECKOUT] Stack:', error.stack)
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Checkout processing failed',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})