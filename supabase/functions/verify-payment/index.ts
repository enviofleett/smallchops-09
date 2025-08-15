import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0/dist/module/index.js'
import { corsHeaders } from '../_shared/cors.ts'
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

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

    // Get environment-specific Paystack configuration
    let finalSecretKey: string;
    try {
      const envConfig = getPaystackConfig(req);
      const validation = validatePaystackConfig(envConfig);
      
      if (!validation.isValid) {
        console.error('[VERIFY-PAYMENT] Paystack configuration invalid:', validation.errors);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Payment service configuration error',
            code: 'PAYSTACK_CONFIG_INVALID',
            details: validation.errors.join(', ')
          }),
          { 
            status: 503, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      logPaystackConfigStatus(envConfig);
      finalSecretKey = envConfig.secretKey;
      
      console.log('[VERIFY-PAYMENT] Using environment-specific key:', finalSecretKey.substring(0, 10) + '...');
      
    } catch (configError) {
      console.error('[VERIFY-PAYMENT] Environment config failed:', configError);
      
      // Fallback to legacy environment variable
      const fallbackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!fallbackKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Payment service configuration error',
            code: 'PAYSTACK_KEY_MISSING',
            details: 'No Paystack secret key configured'
          }),
          { 
            status: 503, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      finalSecretKey = fallbackKey;
      console.log('[VERIFY-PAYMENT] Using fallback PAYSTACK_SECRET_KEY');
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

    console.log('[VERIFY-PAYMENT] Verifying payment with Paystack -', { reference })

    // Verify with Paystack API first
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${finalSecretKey}`,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!paystackResponse.ok) {
      console.error('[VERIFY-PAYMENT] Paystack API error:', paystackResponse.status)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification failed',
          code: 'PAYSTACK_ERROR'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const paystackData: PaystackVerificationResponse = await paystackResponse.json()

    if (!paystackData.status) {
      console.error('[VERIFY-PAYMENT] Paystack verification failed:', paystackData.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification failed',
          code: 'PAYSTACK_VERIFICATION_FAILED'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const transaction = paystackData.data
    const isSuccessful = transaction.status === 'success'

    console.log('[VERIFY-PAYMENT] Paystack verification response -', {
      status: transaction.status,
      amount: transaction.amount,
      reference: transaction.reference,
      gateway_response: transaction.authorization?.authorization_code ? 'Authorized' : 'Unknown'
    })

    if (!isSuccessful) {
      return new Response(
        JSON.stringify({
          success: false,
          payment_status: transaction.status,
          error: 'Payment was not successful',
          reference: transaction.reference
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[VERIFY-PAYMENT] Payment confirmed, updating order status')

    // Find and update order with enhanced lookup
    let order = null
    
    // Try multiple lookup strategies
    if (order_id) {
      // Strategy 1: Direct order ID lookup
      const { data: orderById, error: orderError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single()
      
      if (orderById && !orderError) {
        order = orderById
        console.log('[VERIFY-PAYMENT] Found order by ID:', order.id)
      }
    }

    if (!order) {
      // Strategy 2: Lookup by payment reference  
      const { data: orderByRef, error: refError } = await supabaseClient
        .from('orders')
        .select('*')
        .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .single()
      
      if (orderByRef && !refError) {
        order = orderByRef
        console.log('[VERIFY-PAYMENT] Found order by reference:', order.id)
      }
    }

    if (!order) {
      // Strategy 3: Lookup by amount and recent timestamp
      const amount = transaction.amount / 100 // Convert from kobo
      const { data: ordersByAmount, error: amountError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('total_amount', amount)
        .eq('payment_status', 'pending')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (ordersByAmount && ordersByAmount.length > 0 && !amountError) {
        order = ordersByAmount[0]
        console.log('[VERIFY-PAYMENT] Found order by amount/time match:', order.id)
      }
    }

    if (!order) {
      console.error('[VERIFY-PAYMENT] Order not found for reference:', reference)
      
      // Create orphaned payment record
      try {
        await supabaseClient
          .from('payment_transactions')
          .insert({
            provider_reference: reference,
            amount: transaction.amount / 100,
            currency: transaction.currency || 'NGN',
            status: 'orphaned',
            gateway_response: 'Order not found during verification',
            metadata: {
              paystack_data: transaction,
              verification_timestamp: new Date().toISOString()
            }
          })
        
        console.log('[VERIFY-PAYMENT] Created orphaned payment record')
      } catch (orphanError) {
        console.error('[VERIFY-PAYMENT] Failed to create orphaned payment record:', orphanError)
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Order not found for this payment reference',
          code: 'ORDER_NOT_FOUND',
          reference
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update order status
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paystack_reference: transaction.reference,
        paid_at: new Date(transaction.paid_at),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[VERIFY-PAYMENT] Failed to update order:', updateError.message)
      throw new Error(`Failed to update order: ${updateError.message}`)
    }

    // Create/update payment transaction record
    try {
      await supabaseClient
        .from('payment_transactions')
        .upsert({
          provider_reference: transaction.reference,
          order_id: order.id,
          amount: transaction.amount / 100,
          currency: transaction.currency || 'NGN',
          status: 'paid',
          gateway_response: 'Payment verified successfully',
          metadata: transaction,
          paid_at: transaction.paid_at,
          processed_at: new Date().toISOString()
        }, {
          onConflict: 'provider_reference'
        })
      
      console.log('[VERIFY-PAYMENT] Payment transaction record updated')
    } catch (transactionError) {
      console.error('[VERIFY-PAYMENT] Failed to update payment transaction:', transactionError)
      // Don't fail verification if transaction record update fails
    }

    // REMOVED: Delivery analytics update that was causing failures
    // The delivery_analytics table structure was inconsistent and causing crashes
    // This functionality should be handled by a separate analytics service

    console.log('[VERIFY-PAYMENT] Order updated successfully -', {
      orderNumber: order.order_number,
      paymentStatus: 'paid',
      orderStatus: 'confirmed'
    })

    // Try to send confirmation email (don't fail if it errors)
    try {
      await supabaseClient.functions.invoke('send-order-confirmation', {
        body: {
          orderId: order.id,
          customerEmail: order.customer_email,
          orderNumber: order.order_number
        }
      })
    } catch (emailError) {
      console.log('Failed to send confirmation email:', emailError)
      // Don't fail payment verification if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: transaction.status,
        reference: transaction.reference,
        order_id: order.id,
        amount: transaction.amount / 100,
        paid_at: transaction.paid_at,
        channel: transaction.channel,
        customer_email: transaction.customer.email
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
🔧 HOTFIXED VERIFY-PAYMENT FUNCTION
- ✅ Removed delivery_analytics dependency that was causing crashes
- ✅ Enhanced order lookup with multiple strategies (ID, reference, amount+time)
- ✅ Graceful error handling for all database operations
- ✅ Creates orphaned payment records for unmatched payments
- ✅ Email sending failure won't block payment verification
- ✅ Comprehensive logging for debugging
*/