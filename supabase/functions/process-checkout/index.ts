// supabase/functions/process-checkout/index.ts - Updated to fix reference mismatch
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://startersmallchops.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting checkout process...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('📦 Checkout request:', JSON.stringify(body, null, 2))

    const {
      items = [],
      customer = {},
      delivery = {},
      total_amount,
      idempotency_key
    } = body

    // Validate required fields
    if (!items.length) throw new Error('No items in cart')
    if (!customer.email) throw new Error('Customer email is required')
    if (!total_amount || total_amount <= 0) throw new Error('Invalid total amount')

    // Generate consistent payment reference
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substr(2, 9)
    const paymentReference = `txn_${timestamp}_${randomId}`
    
    console.log('🏷️ Generated payment reference:', paymentReference)

    // Calculate amounts
    const subtotal = items.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0)
    const deliveryFee = delivery.fee || 0
    const calculatedTotal = subtotal + deliveryFee

    // Create order data with BOTH references
    const orderData = {
      id: crypto.randomUUID(),
      reference: paymentReference, // Use same reference for both
      payment_reference: paymentReference, // Critical: Store payment reference
      customer_email: customer.email,
      customer_name: customer.name || 'Guest Customer',
      customer_phone: customer.phone || '',
      items: items,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total_amount: calculatedTotal,
      status: 'pending',
      payment_status: 'pending',
      delivery_method: delivery.method || 'pickup',
      delivery_location: delivery.location || 'Main Store',
      delivery_address: delivery.address || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      idempotency_key: idempotency_key || `checkout_${timestamp}_${randomId}`
    }

    console.log('💾 Creating order with references:', {
      order_id: orderData.id,
      reference: orderData.reference,
      payment_reference: orderData.payment_reference
    })

    // Insert order with upsert to handle duplicates
    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .upsert(orderData, { 
        onConflict: 'idempotency_key',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (orderError) {
      console.error('❌ Database error:', orderError)
      
      if (orderError.code === '23505') {
        // Handle duplicate - fetch existing order
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('idempotency_key', orderData.idempotency_key)
          .single()
        
        if (existingOrder) {
          console.log('♻️ Using existing order:', existingOrder.id)
          
          // Ensure existing order has payment_reference
          if (!existingOrder.payment_reference) {
            await supabase
              .from('orders')
              .update({ payment_reference: paymentReference })
              .eq('id', existingOrder.id)
          }
          
          // Continue with existing order
          orderResult = existingOrder
        }
      }
      
      if (!orderResult) {
        throw new Error(`Database error: ${orderError.message}`)
      }
    }

    console.log('✅ Order created/found:', orderResult?.id)

    // Initialize Paystack payment
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key not configured')
    }

    const paystackPayload = {
      email: customer.email,
      amount: calculatedTotal * 100, // Convert to kobo
      reference: paymentReference, // Use consistent reference
      callback_url: `https://startersmallchops.com/payment/callback?trxref=${paymentReference}&reference=${paymentReference}`,
      metadata: {
        order_id: orderResult?.id || orderData.id,
        customer_name: customer.name,
        items_count: items.length,
        order_reference: paymentReference
      }
    }

    console.log('💳 Initializing Paystack payment:', {
      reference: paystackPayload.reference,
      amount: paystackPayload.amount,
      email: paystackPayload.email
    })

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackPayload)
    })

    const paystackData = await paystackResponse.json()
    console.log('💳 Paystack response status:', paystackResponse.ok, paystackData.status)

    if (!paystackResponse.ok || !paystackData.status) {
      throw new Error(`Paystack error: ${paystackData.message || 'Payment initialization failed'}`)
    }

    // Update order with payment info - CRITICAL STEP
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_reference: paymentReference, // Ensure this is set
        payment_url: paystackData.data.authorization_url,
        paystack_access_code: paystackData.data.access_code,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderResult?.id || orderData.id)

    if (updateError) {
      console.error('⚠️ Payment info update warning:', updateError)
    }

    console.log('✅ Checkout process completed successfully')

    // Verify the order was saved with correct reference
    const { data: verifyOrder } = await supabase
      .from('orders')
      .select('id, reference, payment_reference')
      .eq('id', orderResult?.id || orderData.id)
      .single()

    console.log('🔍 Order verification:', verifyOrder)

    return new Response(JSON.stringify({
      success: true,
      order: {
        id: orderResult?.id || orderData.id,
        reference: paymentReference,
        payment_reference: paymentReference,
        total_amount: calculatedTotal,
        status: 'pending'
      },
      payment: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paymentReference
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('❌ Checkout process failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Checkout failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})