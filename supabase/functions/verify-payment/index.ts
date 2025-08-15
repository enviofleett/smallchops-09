import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reference } = await req.json()
    
    // Input validation
    if (!reference) {
      console.error('[VERIFY-PAYMENT] Missing payment reference')
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

    console.log(`[VERIFY-PAYMENT] Payment verification started - reference: ${reference}`)

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

    // ENHANCED: Handle both txn_ and pay_ reference formats during transition
    let paystackReference = reference;
    
    // If we have a txn_ reference, find the corresponding Paystack reference for verification
    if (reference.startsWith('txn_')) {
      console.log('[VERIFY-PAYMENT] Processing txn_ reference, checking for Paystack reference...');
      
      // First try to find the order and check if it has a paystack_reference
      const { data: orderData } = await supabase
        .from('orders')
        .select('paystack_reference, id, order_number')
        .eq('payment_reference', reference)
        .maybeSingle();
        
      if (orderData?.paystack_reference && orderData.paystack_reference !== reference) {
        paystackReference = orderData.paystack_reference;
        console.log('[VERIFY-PAYMENT] Using paystack_reference for verification:', paystackReference);
      }
    }
    
    // Verify payment with Paystack
    console.log(`[VERIFY-PAYMENT] Verifying payment with Paystack - reference: ${paystackReference}`)
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${paystackReference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!paystackResponse.ok) {
      console.error('[VERIFY-PAYMENT] Paystack API error:', paystackResponse.status)
      throw new Error(`Paystack API error: ${paystackResponse.status}`)
    }

    const paymentData = await paystackResponse.json()
    
    console.log('[VERIFY-PAYMENT] Paystack verification response -', {
      status: paymentData.status,
      amount: paymentData.data?.amount,
      reference: paymentData.data?.reference,
      gateway_response: paymentData.data?.gateway_response
    })
    
    if (paymentData.status === 'success' && paymentData.data.status === 'success') {
      console.log('[VERIFY-PAYMENT] Payment confirmed, updating order status')
      
      // Use the new database function to handle everything atomically
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_order_payment_status', {
          payment_ref: reference,
          new_status: 'confirmed',
          payment_amount: paymentData.data.amount / 100, // Convert from kobo to naira
          payment_gateway_response: paymentData.data
        })

      if (updateError) {
        console.error('[VERIFY-PAYMENT] Database update error:', updateError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Database update failed',
            error: updateError.message 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500 
          }
        )
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('[VERIFY-PAYMENT] No order found for reference:', reference)
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

      console.log('[VERIFY-PAYMENT] Order updated successfully:', updateResult[0])
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment verified and order updated successfully',
          order: {
            order_id: updateResult[0].order_id,
            order_number: updateResult[0].order_number,
            status: updateResult[0].status,
            amount: updateResult[0].amount,
            updated_at: updateResult[0].updated_at
          },
          payment_data: {
            amount: paymentData.data.amount / 100,
            reference: paymentData.data.reference,
            status: paymentData.data.status,
            gateway_response: paymentData.data.gateway_response
          }
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
          paystack_response: paymentData 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      )
    }
  } catch (error) {
    console.error('[VERIFY-PAYMENT] Error:', error.message)
    console.error('[VERIFY-PAYMENT] Stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Payment verification failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})