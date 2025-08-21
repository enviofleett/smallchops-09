
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
      .select('id, total_amount, delivery_fee, payment_reference, customer_name, order_number, order_type')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`)
    }

    // Use authoritative amount from database
    const authoritativeAmount = order.total_amount
    const deliveryFee = order.delivery_fee || 0

    console.log('💰 AUTHORITATIVE AMOUNT (Backend-derived):', {
      client_provided: amount,
      db_total_amount: authoritativeAmount,
      db_delivery_fee: deliveryFee,
      authoritative_amount: authoritativeAmount,
      amount_source: 'database'
    })

    // Check for existing pending/initialized transaction first (IDEMPOTENCY)
    const { data: existingTransaction } = await supabaseAdmin
      .from('payment_transactions')
      .select('reference, authorization_url, access_code, status, provider_reference')
      .eq('order_id', orderId)
      .in('status', ['pending', 'initialized'])
      .maybeSingle()

    if (existingTransaction && existingTransaction.authorization_url) {
      console.log('♻️ IDEMPOTENT REUSE: Found existing valid payment initialization', {
        existing_reference: existingTransaction.reference,
        existing_amount: authoritativeAmount,
        authorization_url: existingTransaction.authorization_url.substring(0, 40) + '...'
      })
      
      return new Response(JSON.stringify({
        success: true,
        status: true,
        data: {
          authorization_url: existingTransaction.authorization_url,
          access_code: existingTransaction.access_code,
          reference: existingTransaction.reference
        },
        message: 'Reusing existing valid payment initialization'
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
      amount: amountInKobo,
      currency: 'NGN',
      reference: finalReference,
      callback_url: callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?reference=${finalReference}&order_id=${orderId}`,
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
        generated_by: 'paystack-secure-v4-production'
      }
    }

    console.log('💳 Initializing payment:', finalReference, 'for', email, 'amount: ₦' + authoritativeAmount)
    console.log('🚀 Sending to Paystack:', JSON.stringify(paystackPayload))

    // Initialize with Paystack (with retry on duplicate reference)
    let paystackResponse: PaystackResponse
    let retryAttempt = 0
    const maxRetries = 2

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

      // Handle duplicate reference error with intelligent retry
      if (response.status === 400 && 
          paystackResponse.message?.includes('Duplicate Transaction Reference')) {
        
        console.log('❌ Duplicate reference detected:', finalReference)
        
        // Check if we have a pending record in our database
        const { data: pendingRecord } = await supabaseAdmin
          .from('payment_transactions')
          .select('authorization_url, access_code, reference')
          .eq('reference', finalReference)
          .in('status', ['pending', 'initialized'])
          .maybeSingle()

        if (pendingRecord && pendingRecord.authorization_url) {
          console.log('✅ Found existing pending record, reusing authorization_url')
          return new Response(JSON.stringify({
            success: true,
            status: true,
            data: {
              authorization_url: pendingRecord.authorization_url,
              access_code: pendingRecord.access_code,
              reference: pendingRecord.reference
            },
            message: 'Reusing existing pending transaction'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
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
          paystackPayload.callback_url = callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?reference=${newReference}&order_id=${orderId}`
          
          retryAttempt++
          continue
        }
      }

      // Other errors or max retries reached
      console.error('❌ Paystack HTTP error:', response.status, JSON.stringify(paystackResponse))
      throw new Error(`Paystack API error (${response.status}): ${paystackResponse.message}`)
    }

    console.log('✅ Paystack payment initialized successfully:', paystackPayload.reference)

    // Create payment transaction record with all required fields and proper status
    const { error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .upsert({
        reference: paystackPayload.reference,
        provider_reference: paystackPayload.reference,
        order_id: orderId,
        provider: 'paystack',
        amount: authoritativeAmount,
        currency: 'NGN',
        status: 'initialized', // Use proper status from constraint
        authorization_url: paystackResponse.data!.authorization_url,
        access_code: paystackResponse.data!.access_code,
        customer_email: email,
        gateway_response: paystackResponse,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'reference'
      })

    if (transactionError) {
      console.error('⚠️ Failed to create payment transaction record:', transactionError)
      // Continue - don't fail the payment initialization
    } else {
      console.log('✅ Payment transaction record created with proper status')
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
