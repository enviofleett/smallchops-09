// supabase/functions/payment-callback/index.ts - Handle both webhook and redirect callbacks
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('🔔 Payment callback received')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const reference = url.searchParams.get('reference') || 
                     url.searchParams.get('trxref') || 
                     url.searchParams.get('txn_ref')
    
    console.log('📋 Processing reference:', reference)
    
    if (!reference) {
      console.error('❌ No payment reference found')
      return createErrorRedirect('Missing payment reference')
    }

    // Verify payment with Paystack
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key not configured')
    }

    console.log('🔍 Verifying with Paystack...')
    
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
    })

    if (!verifyResponse.ok) {
      throw new Error(`Paystack verification failed: ${verifyResponse.status}`)
    }

    const verifyData = await verifyResponse.json()
    console.log('💳 Paystack response:', {
      status: verifyData.status,
      data_status: verifyData.data?.status,
      amount: verifyData.data?.amount
    })

    if (!verifyData.status || !verifyData.data) {
      throw new Error('Payment verification failed')
    }

    const paymentData = verifyData.data

    // Try multiple approaches to find the order
    console.log('🔍 Searching for order...')
    
    let order = null
    let searchMethod = ''

    // Method 1: Direct reference match
    const { data: directMatch } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle()
    
    if (directMatch) {
      order = directMatch
      searchMethod = 'direct_reference'
    }

    // Method 2: Search by reference pattern (remove txn_ prefix)
    if (!order) {
      const cleanRef = reference.replace('txn_', '')
      const { data: patternMatch } = await supabase
        .from('orders')
        .select('*')
        .or(`payment_reference.eq.${cleanRef},reference.eq.${cleanRef}`)
        .maybeSingle()
      
      if (patternMatch) {
        order = patternMatch
        searchMethod = 'pattern_match'
      }
    }

    // Method 3: Search by order reference (if different from payment reference)
    if (!order) {
      const { data: orderRefMatch } = await supabase
        .from('orders')
        .select('*')
        .eq('reference', reference)
        .maybeSingle()
      
      if (orderRefMatch) {
        order = orderRefMatch
        searchMethod = 'order_reference'
      }
    }

    // Method 4: Search by timestamp/amount (last resort)
    if (!order) {
      // Extract timestamp from reference if it follows the pattern
      const timestampMatch = reference.match(/(\d{13})/)
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1])
        const searchDate = new Date(timestamp)
        
        // Search for orders created around the same time with matching amount
        const { data: timeMatch } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', new Date(timestamp - 300000).toISOString()) // 5 min before
          .lte('created_at', new Date(timestamp + 300000).toISOString()) // 5 min after
          .eq('total_amount', Math.floor(paymentData.amount / 100)) // Convert kobo to naira
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (timeMatch) {
          order = timeMatch
          searchMethod = 'timestamp_amount'
        }
      }
    }

    if (!order) {
      console.error('❌ Order not found with any method')
      
      // Create a detailed error log for debugging
      const debugInfo = {
        reference,
        paystack_amount: paymentData.amount,
        paystack_email: paymentData.customer?.email,
        search_attempts: ['direct_reference', 'pattern_match', 'order_reference', 'timestamp_amount']
      }
      
      console.error('🐛 Debug info:', debugInfo)
      
      return createErrorRedirect(`Order not found for payment reference: ${reference}`)
    }

    console.log(`✅ Order found via ${searchMethod}:`, order.id)

    // Update the order with the correct payment reference if needed
    if (order.payment_reference !== reference) {
      console.log('🔄 Updating payment reference...')
      await supabase
        .from('orders')
        .update({ payment_reference: reference })
        .eq('id', order.id)
    }

    // Determine statuses based on Paystack response
    let orderStatus = 'pending'
    let paymentStatus = 'pending'

    switch (paymentData.status) {
      case 'success':
        orderStatus = 'confirmed'
        paymentStatus = 'completed'
        break
      case 'failed':
        orderStatus = 'cancelled'
        paymentStatus = 'failed'
        break
      default:
        orderStatus = 'pending'
        paymentStatus = 'pending'
    }

    console.log('🎯 Status mapping:', { paystack: paymentData.status, order: orderStatus, payment: paymentStatus })

    // Create or update payment transaction
    const { error: upsertError } = await supabase
      .from('payment_transactions')
      .upsert({
        id: crypto.randomUUID(),
        order_id: order.id,
        reference: reference,
        amount: paymentData.amount / 100,
        currency: paymentData.currency || 'NGN',
        status: paymentStatus,
        provider: 'paystack',
        provider_response: paymentData,
        gateway_response: paymentData.gateway_response || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'reference',
        ignoreDuplicates: false 
      })

    if (upsertError) {
      console.error('⚠️ Transaction upsert warning:', upsertError)
    }

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        payment_status: paymentStatus,
        payment_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (orderError) {
      console.error('❌ Order update failed:', orderError)
      throw new Error('Failed to update order status')
    }

    console.log('✅ Payment processing completed successfully')

    // Redirect based on payment status
    const redirectUrl = paymentData.status === 'success'
      ? `https://startersmallchops.com/payment/success?ref=${reference}&order=${order.id}`
      : `https://startersmallchops.com/payment/failed?ref=${reference}&order=${order.id}`

    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders
      }
    })

  } catch (error) {
    console.error('❌ Payment callback error:', error)
    return createErrorRedirect(error.message)
  }
})

function createErrorRedirect(message: string): Response {
  const errorUrl = `https://startersmallchops.com/payment/callback?status=error&message=${encodeURIComponent(message)}`
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': errorUrl,
      ...corsHeaders
    }
  })
}