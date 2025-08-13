import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface VerificationRequest {
  reference: string
  order_id?: string
}

interface PaystackVerificationResponse {
  status: boolean
  message: string
  data: {
    id: number
    domain: string
    status: 'success' | 'failed' | 'abandoned'
    reference: string
    amount: number
    paid_at: string
    created_at: string
    channel: string
    currency: string
    customer: {
      id: number
      email: string
    }
    authorization: {
      authorization_code: string
      bin: string
      last4: string
      exp_month: string
      exp_year: string
      channel: string
      card_type: string
      bank: string
      country_code: string
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[VERIFY-PAYMENT] Payment verification started')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // CRITICAL FIX: Enhanced secret key validation
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      console.error('[VERIFY-PAYMENT] ERROR - PAYSTACK_SECRET_KEY not configured')
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment service configuration error',
          code: 'CONFIG_ERROR',
          details: 'Secret key not configured'
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate secret key format
    if (!paystackSecretKey.startsWith('sk_test_') && !paystackSecretKey.startsWith('sk_live_')) {
      console.error('[VERIFY-PAYMENT] ERROR - Invalid PAYSTACK_SECRET_KEY format')
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment service configuration error',
          code: 'INVALID_KEY_FORMAT'
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[VERIFY-PAYMENT] Secret key validation passed')

    const { reference, order_id } = await req.json() as VerificationRequest

    if (!reference) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment reference is required',
          code: 'MISSING_REFERENCE'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[VERIFY-PAYMENT] Processing reference:', reference)

    // ENHANCED FIX: Multi-format reference handling with fallback
    let ordersQuery = supabaseClient
      .from('orders')
      .select('id, total_amount, status, payment_reference, paystack_reference, order_number')

    // Try multiple reference lookup strategies
    if (reference.startsWith('txn_')) {
      // Backend-generated reference
      ordersQuery = ordersQuery.or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
    } else if (reference.startsWith('pay_')) {
      // Frontend-generated reference - look for associated backend reference
      console.log('[VERIFY-PAYMENT] WARNING - Frontend reference detected, attempting lookup')
      ordersQuery = ordersQuery.or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
    } else {
      // Unknown format - try all fields
      ordersQuery = ordersQuery.or(`payment_reference.eq.${reference},paystack_reference.eq.${reference},order_number.eq.${reference}`)
    }

    console.log('[VERIFY-PAYMENT] Verifying with Paystack API')

    // Verify with Paystack with enhanced error handling
    let paystackResponse: Response
    let paystackData: PaystackVerificationResponse

    try {
      paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          }
        }
      )

      paystackData = await paystackResponse.json()
    } catch (networkError) {
      console.error('[VERIFY-PAYMENT] Network error with Paystack:', networkError)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification service unavailable',
          code: 'NETWORK_ERROR',
          retryable: true
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('[VERIFY-PAYMENT] Paystack verification failed:', {
        status: paystackResponse.status,
        response: paystackData
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification failed',
          code: 'PAYSTACK_VERIFICATION_FAILED',
          details: paystackData.message || 'Unknown error'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const paymentData = paystackData.data
    const isSuccessful = paymentData.status === 'success'

    console.log('[VERIFY-PAYMENT] Paystack verification result:', {
      reference,
      status: paymentData.status,
      amount: paymentData.amount,
      paid_at: paymentData.paid_at
    })

    // Find order with enhanced lookup
    const { data: orders, error: fetchError } = await ordersQuery

    if (fetchError) {
      console.error('[VERIFY-PAYMENT] Error fetching order:', fetchError)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database error while finding order',
          code: 'DB_FETCH_ERROR',
          retryable: true
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!orders || orders.length === 0) {
      // ENHANCED FIX: Create orphaned payment record for tracking
      try {
        await supabaseClient
          .from('payment_transactions')
          .insert({
            provider_reference: reference,
            amount: paymentData.amount / 100,
            currency: paymentData.currency || 'NGN',
            status: 'orphaned',
            gateway_response: 'Order not found during verification',
            metadata: {
              paystack_data: paymentData,
              verification_timestamp: new Date().toISOString()
            }
          })
        
        console.log('[VERIFY-PAYMENT] Created orphaned payment record for reference:', reference)
      } catch (orphanError) {
        console.error('[VERIFY-PAYMENT] Failed to create orphaned payment record:', orphanError)
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order not found for this payment reference',
          code: 'ORDER_NOT_FOUND',
          reference,
          suggestion: 'Please contact support with your payment reference'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const order = orders[0]

    // ENHANCED FIX: Amount verification with tolerance
    const expectedAmount = Math.round(order.total_amount * 100)
    const paidAmount = paymentData.amount
    const tolerance = Math.max(1, Math.round(expectedAmount * 0.01)) // 1% tolerance or 1 kobo minimum

    if (Math.abs(expectedAmount - paidAmount) > tolerance) {
      console.error('[VERIFY-PAYMENT] Amount mismatch detected:', {
        order_id: order.id,
        expected: expectedAmount,
        paid: paidAmount,
        tolerance,
        difference: Math.abs(expectedAmount - paidAmount),
        reference
      })
      
      // Log to security incidents
      try {
        await supabaseClient
          .from('security_incidents')
          .insert({
            type: 'amount_mismatch',
            description: 'Payment amount does not match order amount',
            reference,
            expected_amount: expectedAmount / 100,
            received_amount: paidAmount / 100,
            metadata: {
              order_id: order.id,
              paystack_data: paymentData
            }
          })
      } catch (logError) {
        console.error('[VERIFY-PAYMENT] Failed to log security incident:', logError)
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment amount does not match order amount',
          code: 'AMOUNT_MISMATCH',
          expected: expectedAmount / 100,
          paid: paidAmount / 100,
          reference
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update order status with atomic transaction
    const newStatus = isSuccessful ? 'confirmed' : 'payment_failed'
    const paymentStatus = isSuccessful ? 'paid' : 'failed'
    
    const updateData = {
      status: newStatus,
      payment_status: paymentStatus,
      paid_at: isSuccessful ? new Date().toISOString() : null,
      payment_verified_at: new Date().toISOString(),
      paystack_reference: paymentData.reference, // Ensure reference is stored
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', order.id)

    if (updateError) {
      console.error('[VERIFY-PAYMENT] Failed to update order:', updateError)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update order status',
          code: 'DB_UPDATE_ERROR',
          retryable: true,
          reference
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create/update payment transaction record
    try {
      await supabaseClient
        .from('payment_transactions')
        .upsert({
          provider_reference: paymentData.reference,
          order_id: order.id,
          amount: paidAmount / 100,
          currency: paymentData.currency || 'NGN',
          status: isSuccessful ? 'paid' : 'failed',
          gateway_response: `Payment ${paymentData.status}`,
          metadata: paymentData,
          paid_at: isSuccessful ? paymentData.paid_at : null,
          processed_at: new Date().toISOString()
        })
      
      console.log('[VERIFY-PAYMENT] Payment transaction record updated')
    } catch (transactionError) {
      console.error('[VERIFY-PAYMENT] Failed to update payment transaction:', transactionError)
      // Don't fail the verification if transaction record update fails
    }

    console.log('[VERIFY-PAYMENT] SUCCESS - Order updated successfully:', {
      order_id: order.id,
      status: newStatus,
      payment_status: paymentStatus,
      reference,
      amount: paidAmount / 100
    })

    return new Response(
      JSON.stringify({
        success: isSuccessful,
        payment_status: paymentData.status,
        reference: paymentData.reference,
        order_id: order.id,
        amount: paidAmount / 100,
        paid_at: paymentData.paid_at,
        channel: paymentData.channel,
        customer_email: paymentData.customer.email
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[VERIFY-PAYMENT] ERROR in verify-payment - ' + JSON.stringify({
      message: error.message,
      stack: error.stack
    }))
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payment verification service error',
        code: 'INTERNAL_ERROR',
        message: error.message,
        retryable: true
      }),
      { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})