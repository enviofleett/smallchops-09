import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

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

const VERSION = "v2025-08-22-centralized-config"

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`🔄 Paystack secure function called [${VERSION}]`)
    
    // Get and validate JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization required',
        code: 'UNAUTHORIZED'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const jwt = authHeader.replace('Bearer ', '')
    
    // Initialize Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt)
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError)
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication token',
        code: 'AUTH_INVALID'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ User authenticated:', user.id)

    // Get environment-specific Paystack configuration
    let paystackConfig;
    try {
      paystackConfig = getPaystackConfig(req);
      const validation = validatePaystackConfig(paystackConfig);
      
      if (!validation.isValid) {
        console.error('❌ Paystack configuration invalid:', validation.errors);
        return new Response(JSON.stringify({
          success: false,
          error: 'Payment service configuration error',
          code: 'PAYSTACK_CONFIG_INVALID',
          details: validation.errors.join(', ')
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      logPaystackConfigStatus(paystackConfig);
      
    } catch (configError) {
      console.error('❌ Environment config failed:', configError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment service configuration error',
        code: 'CONFIG_ERROR',
        details: configError.message
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestBody = await req.json()
    console.log('📨 Request payload:', JSON.stringify(requestBody))

    const { action, email, amount, reference, metadata, callback_url } = requestBody

    if (action === 'initialize') {
      return await initializePayment({
        supabaseAdmin,
        supabaseClient,
        user,
        paystackConfig,
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
        supabaseClient,
        user,
        paystackConfig,
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
  supabaseClient,
  user,
  paystackConfig,
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

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Get order details for authorization check
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, delivery_fee, delivery_zone_id, payment_reference, customer_name, order_number, order_type, customer_email, user_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderId}`)
    }

    // Authorization check: admin or order owner
    if (!isAdmin && order.user_id !== user.id) {
      // For guest orders, check if email matches
      if (!order.user_id && order.customer_email === user.email) {
        console.log('✅ Guest order email match authorization')
      } else {
        console.error('❌ Authorization failed - user not order owner', {
          userId: user.id,
          orderUserId: order.user_id,
          userEmail: user.email,
          orderEmail: order.customer_email,
          isAdmin
        })
        throw new Error('Access denied: not authorized for this order')
      }
    }

    console.log('✅ User authorized for order:', { userId: user.id, isAdmin, orderId })

    // Get business settings for website URL
    const { data: businessSettings } = await supabaseAdmin
      .from('business_settings')
      .select('website_url')
      .single()

    const frontendUrl = businessSettings?.website_url || 'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.sandbox.lovable.dev'

    // Order already fetched above for authorization

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

    // Prepare Paystack payload with frontend callback URL
    const frontendCallbackUrl = `${frontendUrl}/payment/callback?order_id=${orderId}`
    const paystackPayload: PaystackInitializePayload = {
      email: email,
      amount: amountInKobo.toString(),
      currency: 'NGN',
      reference: finalReference,
      callback_url: callback_url || frontendCallbackUrl,
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

    const keyEnvironment = paystackConfig.isTestMode ? 'TEST' : 'LIVE';
    // Secure logging - no sensitive data exposure
    console.log('🔑 Using Paystack key environment:', keyEnvironment)
    console.log('💳 Initializing payment for reference:', finalReference, 'amount: ₦' + authoritativeAmount)
    console.log('🔗 Callback URL configured for order_id:', orderId)
    console.log('📝 Payment reference generated:', finalReference)
    // Note: Full payload not logged to prevent secret exposure

    // Initialize with Paystack (with retry on duplicate reference)
    let paystackResponse: PaystackResponse
    let retryAttempt = 0
    const maxRetries = 1

    while (retryAttempt <= maxRetries) {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackConfig.secretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `PaystackSecure/${VERSION}`
        },
        body: JSON.stringify(paystackPayload),
        signal: AbortSignal.timeout(15000) // 15 second timeout
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
          paystackPayload.callback_url = callback_url || frontendCallbackUrl
          
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
  supabaseClient,
  user,
  paystackConfig,
  reference,
  corsHeaders
}: any) {
  try {
    console.log('🔍 Verifying payment:', reference)

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Get payment transaction to check authorization
    const { data: transaction } = await supabaseAdmin
      .from('payment_transactions')
      .select('order_id, customer_email')
      .eq('reference', reference)
      .single()

    if (transaction) {
      // Get order to check ownership
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('user_id, customer_email')
        .eq('id', transaction.order_id)
        .single()

      if (order && !isAdmin && order.user_id !== user.id) {
        // For guest orders, check email match
        if (!order.user_id && order.customer_email === user.email) {
          console.log('✅ Guest order verification authorized')
        } else {
          throw new Error('Access denied: not authorized for this payment')
        }
      }
    }

    console.log('✅ User authorized for payment verification:', { userId: user.id, isAdmin, reference })

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `PaystackSecure/${VERSION}`
      },
      signal: AbortSignal.timeout(15000)
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
