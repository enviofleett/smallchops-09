// verify-payment/index.ts - Updated with enhanced error handling
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reference } = await req.json()
    
    if (!reference) {
      throw new Error('Payment reference is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[VERIFY-PAYMENT] Starting verification for reference: ${reference}`)

    // Step 1: Verify payment with Paystack
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured')
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!paystackResponse.ok) {
      console.error(`[VERIFY-PAYMENT] Paystack API error: ${paystackResponse.status}`)
      throw new Error(`Paystack API error: ${paystackResponse.statusText}`)
    }

    const paymentData = await paystackResponse.json()
    
    console.log('[VERIFY-PAYMENT] Paystack verification response:', {
      status: paymentData.status,
      data_status: paymentData.data?.status,
      reference: paymentData.data?.reference,
      amount: paymentData.data?.amount,
      gateway_response: paymentData.data?.gateway_response
    })

    // Step 2: Check payment status
    if (paymentData.status !== 'success' || paymentData.data?.status !== 'success') {
      console.log('[VERIFY-PAYMENT] Payment verification failed:', paymentData.message)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Payment verification failed',
          paystack_message: paymentData.message,
          paystack_data: {
            status: paymentData.data?.status,
            gateway_response: paymentData.data?.gateway_response
          }
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      )
    }

    console.log('[VERIFY-PAYMENT] Payment verified successfully, updating order status')

    // Step 3: Update order using the enhanced function with improved error handling
    console.log('[VERIFY-PAYMENT] Calling verify_and_update_payment_status with:', {
      payment_ref: reference,
      new_status: 'confirmed',
      payment_amount: paymentData.data.amount / 100,
      has_gateway_response: !!paymentData.data
    })

    // Enhanced retry logic with exponential backoff
    let updateResult;
    let updateAttempts = 0;
    const maxRetries = 3;
    
    while (updateAttempts < maxRetries) {
      try {
        const { data, error } = await supabase
          .rpc('verify_and_update_payment_status', {
            payment_ref: reference,
            new_status: 'confirmed',
            payment_amount: paymentData.data.amount / 100, // Convert from kobo to naira
            payment_gateway_response: paymentData.data
          });

        if (error) {
          console.error(`[VERIFY-PAYMENT] RPC Error (attempt ${updateAttempts + 1}):`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          
          // Handle specific error types
          if (error.message?.includes('ambiguous') || error.message?.includes('column reference')) {
            console.error('[VERIFY-PAYMENT] Database schema error - function needs update');
            throw new Error(`Database schema error: ${error.message}`);
          }
          
          if (error.message?.includes('No order found')) {
            console.error('[VERIFY-PAYMENT] Order not found for reference:', reference);
            throw new Error(`Order not found for reference: ${reference}`);
          }
          
          if (error.message?.includes('Unauthorized')) {
            console.error('[VERIFY-PAYMENT] Authorization error');
            throw new Error(`Authorization error: ${error.message}`);
          }
          
          if (updateAttempts === maxRetries - 1) {
            throw new Error(`Failed to update order after ${maxRetries} attempts: ${error.message}`);
          }
          
          // Exponential backoff: 1s, 2s, 3s
          updateAttempts++;
          console.log(`[VERIFY-PAYMENT] Retrying in ${updateAttempts} seconds...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * updateAttempts));
          continue;
        }
        
        updateResult = data;
        console.log('[VERIFY-PAYMENT] Order update successful:', {
          attempts: updateAttempts + 1,
          result_count: Array.isArray(updateResult) ? updateResult.length : 1
        });
        break;
        
      } catch (rpcError) {
        console.error(`[VERIFY-PAYMENT] RPC Exception (attempt ${updateAttempts + 1}):`, rpcError);
        
        if (updateAttempts === maxRetries - 1) {
          throw new Error(`Failed to update order after ${maxRetries} attempts: ${rpcError.message}`);
        }
        
        updateAttempts++;
        console.log(`[VERIFY-PAYMENT] Exception retry in ${updateAttempts} seconds...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * updateAttempts));
      }
    }

    if (!updateResult || updateResult.length === 0) {
      console.error('[VERIFY-PAYMENT] No order found for reference:', reference)
      
      // Try to find order with different reference format
      const { data: orderSearch } = await supabase
        .from('orders')
        .select('id, order_number, payment_reference, status, fulfillment_type')
        .or(`payment_reference.eq.${reference},payment_reference.eq.txn_${reference.replace('pay_', '')},payment_reference.eq.pay_${reference.replace('txn_', '')}`)
        .limit(5)

      console.log('[VERIFY-PAYMENT] Order search results:', orderSearch)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No order found for this payment reference',
          reference_searched: reference,
          possible_matches: orderSearch || []
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404 
        }
      )
    }

    const updatedOrder = updateResult[0]
    console.log('[VERIFY-PAYMENT] Order updated successfully:', {
      order_id: updatedOrder.order_id,
      order_number: updatedOrder.order_number,
      status: updatedOrder.status,
      fulfillment_type: updatedOrder.fulfillment_type
    })

    // Step 4: Send confirmation based on fulfillment type
    try {
      if (updatedOrder.fulfillment_type === 'delivery') {
        console.log('[VERIFY-PAYMENT] Processing delivery confirmation')
        // Additional delivery-specific processing can go here
      } else {
        console.log('[VERIFY-PAYMENT] Processing pickup confirmation')
        // Additional pickup-specific processing can go here
      }
    } catch (confirmationError) {
      console.warn('[VERIFY-PAYMENT] Confirmation processing failed:', confirmationError.message)
      // Don't fail the payment verification if confirmation fails
    }

    // Step 5: Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Payment verified and order updated successfully',
        order: {
          id: updatedOrder.order_id,
          order_number: updatedOrder.order_number,
          status: updatedOrder.status,
          amount: updatedOrder.amount,
          fulfillment_type: updatedOrder.fulfillment_type,
          payment_reference: updatedOrder.payment_reference,
          customer_email: updatedOrder.customer_email
        },
        payment_data: {
          amount: paymentData.data.amount / 100,
          reference: paymentData.data.reference,
          status: paymentData.data.status,
          gateway_response: paymentData.data.gateway_response,
          paid_at: paymentData.data.paid_at
        }
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )

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