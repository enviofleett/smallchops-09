import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PaystackInitializePayload {
  email: string
  amount: number
  currency: string
  reference: string
  callback_url?: string
  channels?: string[]
  metadata?: any
}

interface PaystackResponse {
  status: boolean
  message: string
  data?: {
    authorization_url: string
    access_code: string
    reference: string
  }
  meta?: any
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      console.error('❌ PAYSTACK_SECRET_KEY not configured')
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment service configuration error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestBody = await req.json()
    console.log('🔄 Paystack secure function called [v2025-08-21-production-fix]')
    console.log('📨 Request payload:', JSON.stringify(requestBody))

    const { action, email, amount, reference, metadata, callback_url } = requestBody

    if (action === 'initialize') {
      return await initializePayment({
        supabaseAdmin,
        paystackSecretKey,
        email,
        amount,
        reference,
        metadata,
        callback_url,
        corsHeaders
      })
    }

    if (action === 'verify') {
      return await verifyPayment({
        supabaseAdmin,
        paystackSecretKey,
        reference: reference || requestBody.reference,
        corsHeaders
      })
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Paystack secure function error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function initializePayment({
  supabaseAdmin,
  paystackSecretKey,
  email,
  amount,
  reference,
  metadata,
  callback_url,
  corsHeaders
}: any) {
  try {
    const orderId = metadata?.order_id
    if (!orderId) {
      throw new Error('order_id is required in metadata')
    }

    console.log('🔍 Fetching authoritative order data:', orderId)

    // Get order details for authoritative amount
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, delivery_fee, delivery_zone_id, payment_reference, customer_name, order_number, order_type')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`)
    }

    // Compute authoritative amount to ensure delivery fee is included
    let deliveryFee = Number(order.delivery_fee) || 0

    // If delivery fee isn't set but order is delivery, try to derive from delivery zone
    if ((!deliveryFee || deliveryFee <= 0) && order.order_type === 'delivery' && order.delivery_zone_id) {
      const { data: zone, error: zoneError } = await supabaseAdmin
        .from('delivery_zones')
        .select('base_fee')
        .eq('id', order.delivery_zone_id)
        .eq('is_active', true)
        .maybeSingle()
      if (!zoneError && zone?.base_fee) {
        deliveryFee = Number(zone.base_fee) || 0
      }
    }

    // Sum items subtotal directly from order_items to avoid stale totals
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('total_price')
      .eq('order_id', orderId)
    const itemsSubtotal = (orderItems || []).reduce((sum: number, it: any) => sum + (Number(it.total_price) || 0), 0)

    // Prefer the computed total (items + delivery) if it differs meaningfully
    let authoritativeAmount = Number(order.total_amount) || 0
    const computedTotal = Number(itemsSubtotal) + Number(deliveryFee)

    // If order.total_amount is missing or out-of-sync (> 1 naira diff), correct it
    if (!authoritativeAmount || Math.abs(authoritativeAmount - computedTotal) > 1) {
      authoritativeAmount = computedTotal
      await supabaseAdmin
        .from('orders')
        .update({ 
          delivery_fee: deliveryFee,
          total_amount: authoritativeAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    }

    console.log('💰 AUTHORITATIVE AMOUNT (Backend-derived):', {
      client_provided: amount,
      db_total_amount: order.total_amount,
      db_delivery_fee: order.delivery_fee,
      items_subtotal: itemsSubtotal,
      authoritative_amount: authoritativeAmount,
      amount_source: 'database+recomputed'
    })

    // Check if order already has a pending/initialized transaction
    const { data: existingTransaction } = await supabaseAdmin
      .from('payment_transactions')
      .select('reference, authorization_url, access_code, status')
      .eq('order_id', orderId)
      .in('status', ['pending', 'initialized'])
      .maybeSingle()

    if (existingTransaction) {
      console.log('✅ Reusing existing pending transaction:', existingTransaction.reference)
      return new Response(JSON.stringify({
        success: true,
        status: true,
        data: {
          authorization_url: existingTransaction.authorization_url,
          access_code: existingTransaction.access_code,
          reference: existingTransaction.reference
        },
        message: 'Reusing existing pending transaction'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use existing reference or generate new one
    let finalReference = reference || order.payment_reference
    if (!finalReference) {
      finalReference = `txn_${Date.now()}_${orderId.replace(/-/g, '').substring(0, 8)}`
      
      // Update order with new reference
      await supabaseAdmin
        .from('orders')
        .update({ 
          payment_reference: finalReference,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      console.log('📝 Updated order with new canonical reference')
    } else {
      console.log('✅ Using existing order payment_reference:', finalReference)
    }

    const amountInKobo = Math.round(authoritativeAmount * 100)

    console.log('💰 FINAL AMOUNT DETAILS:', {
      authoritative_amount_naira: authoritativeAmount,
      amount_in_kobo: amountInKobo,
      reference: finalReference,
      order_found: true
    })

    // Prepare Paystack payload
    const paystackPayload: PaystackInitializePayload = {
      email: email,
      amount: amountInKobo.toString(),
      currency: 'NGN',
      reference: finalReference,
      callback_url: callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?order_id=${orderId}`,
      channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      metadata: {
        order_id: orderId,
        customer_name: order.customer_name,
        order_number: order.order_number,
        fulfillment_type: order.order_type,
        items_subtotal: authoritativeAmount - deliveryFee,
        delivery_fee: deliveryFee,
        client_total: amount,
        authoritative_total: authoritativeAmount,
        amount_source: 'database',
        authoritative_amount: authoritativeAmount,
        generated_by: 'paystack-secure-v3'
      }
    }

    const keyEnvironment = paystackSecretKey.includes('test') ? 'TEST' : 'LIVE';
    console.log('🔑 Using Paystack secret key:', paystackSecretKey.substring(0, 10) + '...', `[${keyEnvironment}]`)
    console.log('💳 Initializing payment:', finalReference, 'for', email, 'amount: ₦' + authoritativeAmount)
    console.log('🔗 Callback URL configured (no reference injection):', paystackPayload.callback_url)
    console.log('📝 Canonical reference for verification:', finalReference)
    console.log('🚀 Sending to Paystack:', JSON.stringify(paystackPayload))

    // Initialize with Paystack (with retry on duplicate reference)
    let paystackResponse: PaystackResponse
    let retryAttempt = 0
    const maxRetries = 1

    while (retryAttempt <= maxRetries) {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paystackPayload)
      })

      console.log('📡 Paystack response status:', response.status)
      paystackResponse = await response.json()

      if (response.ok && paystackResponse.status) {
        console.log('📦 Paystack response data:', JSON.stringify(paystackResponse))
        break
      }

      // Handle duplicate reference error
      if (response.status === 400 && 
          paystackResponse.message?.includes('Duplicate Transaction Reference')) {
        
        console.log('❌ Paystack HTTP error:', response.status, JSON.stringify(paystackResponse))
        
        if (retryAttempt < maxRetries) {
          // Generate new reference and retry
          const newReference = `txn_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`
          console.log('🔄 Retrying with new reference:', newReference)
          
          // Update order and payload with new reference
          await supabaseAdmin
            .from('orders')
            .update({ 
              payment_reference: newReference,
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
          
          paystackPayload.reference = newReference
          paystackPayload.callback_url = callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?order_id=${orderId}`
          
          retryAttempt++
          continue
        }
      }

      // Other errors or max retries reached
      console.error('❌ Paystack HTTP error:', response.status, JSON.stringify(paystackResponse))
      throw new Error(`Paystack API error (${response.status}): ${paystackResponse.message}`)
    }

    console.log('✅ Paystack payment initialized successfully:', paystackPayload.reference)

    // Create payment transaction record with all required fields
    const { error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .upsert({
        reference: paystackPayload.reference,
        provider_reference: paystackPayload.reference,
        order_id: orderId,
        amount: authoritativeAmount,
        currency: 'NGN',
        status: 'pending',
        provider: 'paystack',
        customer_email: email,
        authorization_url: paystackResponse.data!.authorization_url,
        access_code: paystackResponse.data!.access_code,
        raw_provider_payload: paystackResponse,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'reference'
      })

    if (transactionError) {
      console.error('⚠️ Failed to create payment transaction record:', transactionError)
      // Don't fail the payment initialization - log and continue
    } else {
      console.log('✅ Payment transaction record created/updated')
    }

    return new Response(JSON.stringify({
      success: true,
      status: true,
      data: {
        authorization_url: paystackResponse.data!.authorization_url,
        access_code: paystackResponse.data!.access_code,
        reference: paystackPayload.reference
      },
      order_id: orderId,
      amount: authoritativeAmount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Payment initialization error:', error)
    throw error
  }
}

async function verifyPayment({
  supabaseAdmin,
  paystackSecretKey,
  reference,
  corsHeaders
}: any) {
  try {
    console.log('🔍 Verifying payment:', reference)

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      }
    })

    const verificationData = await response.json()

    if (!response.ok) {
      throw new Error(`Paystack verification failed: ${response.status}`)
    }

    return new Response(JSON.stringify({
      success: verificationData.status,
      status: verificationData.status,
      data: verificationData.data
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Payment verification error:', error)
    throw error
  }
}
