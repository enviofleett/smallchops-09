import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { reference } = await req.json()
    
    // Input validation
    if (!reference) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment reference is required' 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      )
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[VERIFY-PAYMENT] Verifying payment with Paystack - reference: ${reference}`)

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    
    if (!paystackSecretKey) {
      console.error('[VERIFY-PAYMENT] PAYSTACK_SECRET_KEY not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment service configuration error' 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503 
        }
      )
    }

    // Verify payment with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    })

    const paymentData = await paystackResponse.json()
    
    console.log('[VERIFY-PAYMENT] Paystack verification response -', {
      status: paymentData.status,
      amount: paymentData.data?.amount,
      reference: paymentData.data?.reference,
      gateway_response: paymentData.data?.gateway_response
    })
    
    if (paymentData.status === 'success' && paymentData.data.status === 'success') {
      console.log('[VERIFY-PAYMENT] Payment confirmed, updating order status')
      
      // Find order by payment reference (try multiple formats)
      const { data: orders, error: findError } = await supabase
        .from('orders')
        .select('id, total_amount, status, payment_status')
        .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .limit(1)

      if (findError) {
        console.error('[VERIFY-PAYMENT] Error finding order:', findError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Database error while finding order' 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500 
          }
        )
      }

      if (!orders || orders.length === 0) {
        console.error('[VERIFY-PAYMENT] Order not found for reference:', reference)
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Order not found for payment reference' 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404 
          }
        )
      }

      const order = orders[0]

      // Check if already processed (idempotency)
      if (order.payment_status === 'paid') {
        console.log('[VERIFY-PAYMENT] Payment already processed for order:', order.id)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Payment already processed',
            order_id: order.id
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200 
          }
        )
      }

      // Update order status - use explicit column names to avoid ambiguity
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed', 
          payment_status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select()

      if (orderError) {
        console.error('[VERIFY-PAYMENT] Error updating order:', orderError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to update order status',
            error: orderError.message 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500 
          }
        )
      }

      // Create payment transaction record
      try {
        await supabase
          .from('payment_transactions')
          .upsert({
            provider_reference: reference,
            order_id: order.id,
            amount: paymentData.data.amount / 100, // Convert from kobo to naira
            currency: paymentData.data.currency || 'NGN',
            status: 'paid',
            gateway_response: paymentData.data.gateway_response,
            provider_response: paymentData.data,
            paid_at: paymentData.data.paid_at,
            processed_at: new Date().toISOString()
          })
      } catch (transactionError) {
        console.error('[VERIFY-PAYMENT] Failed to create payment transaction:', transactionError)
        // Don't fail the verification if transaction logging fails
      }

      console.log('[VERIFY-PAYMENT] Order updated successfully:', orderData)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment verified and order updated',
          order_id: order.id,
          order_data: orderData 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      )
    } else {
      console.log('[VERIFY-PAYMENT] Payment verification failed:', paymentData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment verification failed',
          details: paymentData 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      )
    }
  } catch (error) {
    console.error('[VERIFY-PAYMENT] Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})