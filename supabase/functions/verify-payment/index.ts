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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured')
    }

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

    // 🚨 SECURITY: Reject frontend-generated references
    if (reference.startsWith('pay_')) {
      console.error('🚨 SECURITY VIOLATION: Attempt to verify frontend-generated reference:', {
        reference,
        order_id,
        timestamp: new Date().toISOString(),
        ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot verify frontend-generated payment references',
          code: 'INVALID_REFERENCE_SOURCE'
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Ensure reference is backend-generated
    if (!reference.startsWith('txn_')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid reference format. Must be backend-generated.',
          code: 'INVALID_REFERENCE_FORMAT'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔍 Verifying payment reference:', reference)

    // Verify with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        }
      }
    )

    const paystackData: PaystackVerificationResponse = await paystackResponse.json()

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('Paystack verification failed:', paystackData)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification failed',
          code: 'PAYSTACK_VERIFICATION_FAILED',
          details: paystackData.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const paymentData = paystackData.data
    const isSuccessful = paymentData.status === 'success'

    console.log('Paystack verification result:', {
      reference,
      status: paymentData.status,
      amount: paymentData.amount,
      paid_at: paymentData.paid_at
    })

    // Find and update the order
    const { data: orders, error: fetchError } = await supabaseClient
      .from('orders')
      .select('id, total_amount, status, payment_reference')
      .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)

    if (fetchError) {
      console.error('Error fetching order:', fetchError)
      throw new Error('Failed to fetch order')
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order not found for this payment reference',
          code: 'ORDER_NOT_FOUND'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const order = orders[0]

    // Verify amount matches (convert from kobo to naira for comparison)
    const expectedAmount = Math.round(order.total_amount * 100)
    const paidAmount = paymentData.amount

    if (Math.abs(expectedAmount - paidAmount) > 1) { // 1 kobo tolerance
      console.error('Amount mismatch:', {
        expected: expectedAmount,
        paid: paidAmount,
        reference
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment amount does not match order amount',
          code: 'AMOUNT_MISMATCH',
          expected: expectedAmount,
          paid: paidAmount
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update order status based on payment result
    const newStatus = isSuccessful ? 'confirmed' : 'payment_failed'
    const paymentStatus = isSuccessful ? 'paid' : 'failed'
    
    const updateData = {
      status: newStatus,
      payment_status: paymentStatus,
      paid_at: isSuccessful ? new Date().toISOString() : null,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to update order:', updateError)
      throw new Error('Failed to update order status')
    }

    console.log('✅ Order updated successfully:', {
      order_id: order.id,
      status: newStatus,
      payment_status: paymentStatus,
      reference,
      amount: paidAmount
    })

    return new Response(
      JSON.stringify({
        success: isSuccessful,
        payment_status: paymentData.status,
        reference,
        order_id: order.id,
        amount: paidAmount / 100, // Convert back to naira
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
    console.error('Payment verification error:', error)
    
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