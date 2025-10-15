import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getPaystackConfig, logPaystackConfigStatus } from "../_shared/paystack-config.ts"
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  try {
    console.log('🔍 Payment verification started')
    
    // Initialize request tracking ID for better debugging
    const requestId = crypto.randomUUID()
    console.log('🆔 Request ID:', requestId)
    
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
    let paystackSignature: string | null = null
    
    // Try to get data from request body and signature
    try {
      if (req.body) {
        requestData = await req.json()
        paystackSignature = req.headers.get('x-paystack-signature')
      }
    } catch (e) {
      console.log('No JSON body, using query params only')
    }
    
    const paymentReference = reference || requestData.reference || requestData.trxref
    
    console.log('📋 Processing payment reference:', paymentReference, 'Request ID:', requestId)
    
    if (!paymentReference) {
      console.error('❌ No payment reference provided')
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment reference is required',
        request_id: requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Get Paystack configuration with environment detection
    let paystackConfig
    try {
      paystackConfig = getPaystackConfig(req)
      logPaystackConfigStatus(paystackConfig)
    } catch (configError) {
      console.error('❌ Paystack configuration error:', configError)
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment system configuration error',
        request_id: requestId
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Check for duplicate processing (idempotency)
    console.log('🔄 Checking for existing transaction...')
    const { data: existingTransaction, error: existingError } = await supabase
      .from('payment_transactions')
      .select('id, status, order_id, created_at')
      .eq('reference', paymentReference)
      .maybeSingle()

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('❌ Database error checking existing transaction:', existingError)
      throw new Error(`Database error: ${existingError.message}`)
    }

    if (existingTransaction) {
      console.log('ℹ️ Payment transaction already exists:', existingTransaction.id, 'Status:', existingTransaction.status)
      
      // If transaction exists and is successful, return cached result
      if (existingTransaction.status === 'completed') {
        const { data: order } = await supabase
          .from('orders')
          .select('id, order_number, status, payment_status, total_amount')
          .eq('id', existingTransaction.order_id)
          .single()

        return new Response(JSON.stringify({
          success: true,
          message: 'Payment already verified (cached)',
          order_id: existingTransaction.order_id,
          order_number: order?.order_number,
          payment_status: existingTransaction.status,
          order_status: order?.status,
          amount: order?.total_amount,
          reference: paymentReference,
          request_id: requestId,
          cached: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      }
    }

    console.log('🔐 Verifying payment with Paystack...')
    
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paymentReference}`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackConfig.secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text()
      console.error('❌ Paystack API error:', paystackResponse.status, errorText)
      throw new Error(`Paystack API error: ${paystackResponse.status} - ${errorText}`)
    }

    const verificationData = await paystackResponse.json()
    console.log('💳 Paystack verification response:', {
      status: verificationData.status,
      data_status: verificationData.data?.status,
      reference: verificationData.data?.reference,
      amount: verificationData.data?.amount,
      request_id: requestId
    })

    if (!verificationData.status || !verificationData.data) {
      console.error('❌ Invalid Paystack response structure:', verificationData)
      throw new Error(`Payment verification failed: ${verificationData.message || 'Invalid response structure'}`)
    }

    const paymentData = verificationData.data

    // Find the order by payment reference with better error handling
    console.log('🔍 Finding order with reference:', paymentReference)
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_email, total_amount, status, payment_status, payment_reference')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (orderError) {
      console.error('❌ Database error finding order:', orderError)
      throw new Error(`Database error: ${orderError.message}`)
    }

    if (!order) {
      console.error('❌ Order not found for reference:', paymentReference)
      throw new Error('Order not found for payment reference')
    }

    console.log('📋 Found order:', order.id, 'Current status:', order.status, 'Paystack status:', paymentData.status)

    // Validate status mapping with enhanced error handling
    let orderStatus: string
    let paymentStatus: string

    // Validate payment amounts match (security check)
    // Total amount already includes transaction fee stored in database
    const expectedAmount = Math.round(order.total_amount * 100) // Convert to kobo
    const receivedAmount = paymentData.amount
    
    if (Math.abs(expectedAmount - receivedAmount) > 1) { // Allow 1 kobo tolerance
      console.error('❌ Amount mismatch:', {
        expected: expectedAmount,
        received: receivedAmount,
        order_total: order.total_amount,
        difference: Math.abs(expectedAmount - receivedAmount)
      })
      throw new Error('Payment amount mismatch - possible fraud attempt')
    }

    switch (paymentData.status) {
      case 'success':
        orderStatus = 'confirmed'
        paymentStatus = 'completed'
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
        console.warn('⚠️ Unknown Paystack status:', paymentData.status)
        orderStatus = 'pending'
        paymentStatus = 'pending'
    }

    console.log('🎯 Status mapping:', {
      paystack: paymentData.status,
      order_status: orderStatus,
      payment_status: paymentStatus,
      amount_verified: true,
      request_id: requestId
    })

    // Handle transaction creation/update with proper error handling
    let transactionId = existingTransaction?.id

    if (!existingTransaction) {
      console.log('💾 Creating payment transaction record...')
      
      // Create payment transaction with enhanced data validation
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          id: crypto.randomUUID(),
          order_id: order.id,
          reference: paymentReference,
          amount: paymentData.amount / 100, // Convert from kobo to naira
          currency: paymentData.currency || 'NGN',
          status: paymentStatus, // Use validated status
          provider: 'paystack',
          provider_response: paymentData,
          gateway_response: paymentData.gateway_response || paymentData.message || '',
          channel: paymentData.channel || 'card',
          fees: paymentData.fees ? (paymentData.fees / 100) : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (transactionError) {
        console.error('❌ Transaction creation failed:', transactionError)
        
        // Enhanced error logging for debugging
        if (transactionError.code === '23514') {
          console.error('❌ Status constraint violation details:', {
            attempted_status: paymentStatus,
            valid_statuses: 'pending, initialized, paid, failed, cancelled, refunded, orphaned, mismatch, superseded, authorized, completed',
            paystack_status: paymentData.status
          })
        }
        
        throw new Error(`Failed to create payment transaction: ${transactionError.message}`)
      }

      transactionId = transaction?.id
      console.log('✅ Payment transaction created:', transactionId)
    } else {
      console.log('ℹ️ Payment transaction already exists, updating status...', transactionId)
      
      // Update existing transaction if status changed
      if (existingTransaction.status !== paymentStatus) {
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            status: paymentStatus,
            provider_response: paymentData,
            gateway_response: paymentData.gateway_response || paymentData.message || '',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTransaction.id)

        if (updateError) {
          console.error('❌ Transaction update failed:', updateError)
          throw new Error(`Failed to update payment transaction: ${updateError.message}`)
        }
        console.log('✅ Payment transaction updated')
      }
    }

    // Update order status with enhanced validation
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

    // Queue email notification for successful payments
    if (paymentStatus === 'completed' && order.customer_email) {
      try {
        const { error: emailError } = await supabase
          .from('communication_events')
          .insert({
            event_type: 'order_status_update',
            recipient_email: order.customer_email,
            template_key: 'order_confirmed',
            template_variables: {
              customer_name: order.customer_name || 'Customer',
              order_number: order.order_number,
              total_amount: order.total_amount
            },
            status: 'queued',
            order_id: order.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (emailError) {
          console.warn('⚠️ Failed to queue confirmation email:', emailError)
          // Don't fail the payment verification for email issues
        } else {
          console.log('📧 Confirmation email queued')
        }
      } catch (emailErr) {
        console.warn('⚠️ Email queuing error:', emailErr)
      }
    }

    // Return comprehensive success response with order_number for guest tracking
    const response = {
      success: true,
      message: 'Payment verified and order updated successfully',
      order_id: order.id,
      order_number: order.order_number,
      payment_status: paymentStatus,
      order_status: orderStatus,
      amount: paymentData.amount / 100,
      reference: paymentReference,
      transaction_id: transactionId,
      channel: paymentData.channel,
      request_id: requestId,
      verified_at: new Date().toISOString()
    }

    console.log('✅ Payment verification completed successfully:', response)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('❌ Payment verification error:', error)
    
    // Enhanced error response with debugging information
    const errorResponse = {
      success: false,
      error: 'Payment verification failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID() // Fallback request ID
    }

    // Add specific error codes for common issues
    if (error.message.includes('Order not found')) {
      errorResponse.error_code = 'ORDER_NOT_FOUND'
    } else if (error.message.includes('Paystack API error')) {
      errorResponse.error_code = 'PAYSTACK_API_ERROR'
    } else if (error.message.includes('Database error')) {
      errorResponse.error_code = 'DATABASE_ERROR'
    } else if (error.message.includes('amount mismatch')) {
      errorResponse.error_code = 'AMOUNT_MISMATCH'
    }
    
    const statusCode = error.message.includes('Order not found') ? 404 : 500
    
    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})