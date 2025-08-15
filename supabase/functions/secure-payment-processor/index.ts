import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PaymentRequest {
  order_id: string
  amount: number
  customer_email: string
  redirect_url?: string
  metadata?: any
}

interface PaystackInitResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Import environment-specific configuration
    const { getPaystackConfig } = await import('../_shared/paystack-config.ts')
    const paystackConfig = getPaystackConfig(req)
    
    console.log(`🔑 Using ${paystackConfig.environment} environment with key: ${paystackConfig.secretKey.substring(0, 10)}...`)

    const { order_id, amount, customer_email, redirect_url, metadata } = await req.json() as PaymentRequest

    if (!order_id || !amount || !customer_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: order_id, amount, customer_email',
          code: 'MISSING_REQUIRED_FIELDS'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 🚨 SECURITY: Generate secure backend reference only
    const secureReference = `txn_${Date.now()}_${order_id}`

    console.log('🔐 Generating secure payment for order:', {
      order_id,
      reference: secureReference,
      amount,
      customer_email
    })

    // Verify order exists
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, total_amount, status')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify amount matches order
    if (Math.abs(order.total_amount - amount) > 0.01) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Amount mismatch with order',
          code: 'AMOUNT_MISMATCH',
          expected: order.total_amount,
          provided: amount
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize payment with Paystack
    const paystackPayload = {
      email: customer_email,
      amount: Math.round(amount * 100), // Convert to kobo
      reference: secureReference,
      callback_url: redirect_url || `${Deno.env.get('FRONTEND_URL')}/payment-callback`,
      metadata: {
        order_id,
        generated_by: 'secure-backend',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    })

    const paystackData: PaystackInitResponse = await paystackResponse.json()

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('Paystack initialization failed:', paystackData)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to initialize payment with Paystack',
          code: 'PAYSTACK_INIT_FAILED',
          details: paystackData.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update order with secure reference
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        payment_reference: secureReference,
        paystack_reference: secureReference,
        status: 'payment_initiated',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    if (updateError) {
      console.error('Failed to update order with reference:', updateError)
      throw new Error('Failed to update order')
    }

    console.log('✅ Secure payment initialized:', {
      order_id,
      reference: secureReference,
      authorization_url: paystackData.data.authorization_url
    })

    return new Response(
      JSON.stringify({
        success: true,
        reference: secureReference,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        order_id,
        amount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Secure payment processor error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/*
🔐 SECURE PAYMENT PROCESSOR
- ✅ Only backend generates payment references (txn_ format)
- ✅ Validates order exists and amount matches
- ✅ Integrates with Paystack securely
- ✅ Updates order with secure reference
- ✅ Comprehensive error handling and logging

🔧 USAGE:
POST /functions/v1/secure-payment-processor
{
  "order_id": "uuid",
  "amount": 649.90,
  "customer_email": "user@example.com",
  "redirect_url": "https://yoursite.com/callback"
}

📊 RESPONSE:
{
  "success": true,
  "reference": "txn_1734567890123_order-uuid",
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "order_id": "uuid",
  "amount": 649.90
}
*/