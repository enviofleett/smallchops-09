import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://startersmallchops.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    console.log('🔍 Payment verification started')
    
    // Use service role key for database operations (no user authentication needed for webhooks)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get payment reference from query params or body
    const url = new URL(req.url)
    const reference = url.searchParams.get('reference') || 
                     url.searchParams.get('trxref') || 
                     url.searchParams.get('txn_ref')
    
    let requestData: any = {}
    
    // Try to get data from request body
    try {
      if (req.body) {
        requestData = await req.json()
      }
    } catch (e) {
      console.log('No JSON body, using query params only')
    }
    
    const paymentReference = reference || requestData.reference || requestData.trxref
    
    console.log('📋 Processing payment reference:', paymentReference)
    
    if (!paymentReference) {
      console.error('❌ No payment reference provided')
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment reference is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Verify with Paystack
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key not configured')
    }

    console.log('🔐 Verifying payment with Paystack...')
    
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paymentReference}`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!paystackResponse.ok) {
      throw new Error(`Paystack API error: ${paystackResponse.status}`)
    }

    const verificationData = await paystackResponse.json()
    console.log('💳 Paystack verification response:', {
      status: verificationData.status,
      data_status: verificationData.data?.status,
      reference: verificationData.data?.reference,
      amount: verificationData.data?.amount
    })

    if (!verificationData.status || !verificationData.data) {
      throw new Error(`Payment verification failed: ${verificationData.message}`)
    }

    const paymentData = verificationData.data

    // Find the order by payment reference
    console.log('🔍 Finding order with reference:', paymentReference)
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_reference', paymentReference)
      .single()

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError)
      throw new Error('Order not found for payment reference')
    }

    console.log('📋 Found order:', order.id, 'Status:', paymentData.status)

    // Map Paystack status to our database enums with proper validation
    let orderStatus: string
    let paymentStatus: string

    switch (paymentData.status) {
      case 'success':
        orderStatus = 'confirmed'
        paymentStatus = 'completed'  // Use 'completed' instead of 'paid'
        break
      case 'failed':
        orderStatus = 'cancelled'
        paymentStatus = 'failed'
        break
      case 'abandoned':
      case 'timeout':
        orderStatus = 'pending'
        paymentStatus = 'failed'
        break
      default:
        orderStatus = 'pending'
        paymentStatus = 'pending'
    }

    console.log('🎯 Status mapping:', {
      paystack: paymentData.status,
      order_status: orderStatus,
      payment_status: paymentStatus
    })

    // Check if payment transaction already exists
    const { data: existingTransaction } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('reference', paymentReference)
      .single()

    let transactionId = existingTransaction?.id

    if (!existingTransaction) {
      console.log('💾 Creating payment transaction record...')
      
      // Create payment transaction with proper status values
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          id: crypto.randomUUID(),
          order_id: order.id,
          reference: paymentReference,
          amount: paymentData.amount / 100, // Convert from kobo to naira
          currency: paymentData.currency || 'NGN',
          status: paymentStatus, // Use mapped status
          provider: 'paystack',
          provider_response: paymentData,
          gateway_response: paymentData.gateway_response || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (transactionError) {
        console.error('❌ Transaction creation failed:', transactionError)
        
        // Log the specific constraint error for debugging
        if (transactionError.code === '23514') {
          console.error('❌ Status constraint violation. Attempted status:', paymentStatus)
          console.error('❌ Valid statuses should be: pending, completed, failed, cancelled')
        }
        
        throw new Error(`Failed to create payment transaction: ${transactionError.message}`)
      }

      transactionId = transaction?.id
      console.log('✅ Payment transaction created:', transactionId)
    } else {
      console.log('ℹ️ Payment transaction already exists:', transactionId)
    }

    // Update order status
    console.log('🔄 Updating order status...')
    
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        payment_status: paymentStatus,
        payment_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (orderUpdateError) {
      console.error('❌ Order update failed:', orderUpdateError)
      throw new Error(`Failed to update order: ${orderUpdateError.message}`)
    }

    console.log('✅ Order updated successfully')

    // Return success response
    const response = {
      success: true,
      message: 'Payment verified and order updated',
      order_id: order.id,
      payment_status: paymentStatus,
      order_status: orderStatus,
      amount: paymentData.amount / 100,
      reference: paymentReference
    }

    console.log('✅ Payment verification completed:', response)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('❌ Payment verification error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Payment verification failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})