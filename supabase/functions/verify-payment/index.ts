
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
    console.log('[VERIFY-PAYMENT-V2] Payment verification started')
    
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
        console.error('[VERIFY-PAYMENT-V2] Paystack configuration invalid:', validation.errors);
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
      
      console.log('[VERIFY-PAYMENT-V2] Using environment-specific key:', finalSecretKey.substring(0, 10) + '...');
      
    } catch (configError) {
      console.error('[VERIFY-PAYMENT-V2] Environment config failed:', configError);
      
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
      console.log('[VERIFY-PAYMENT-V2] Using fallback PAYSTACK_SECRET_KEY');
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

    console.log('[VERIFY-PAYMENT-V2] Verifying payment with Paystack:', { reference })

    // Enhanced Paystack verification with retry logic
    const maxRetries = 3;
    let paystackResponse;
    let paystackData;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[VERIFY-PAYMENT-V2] Verification attempt ${attempt}/${maxRetries}:`, { reference });
      
      try {
        paystackResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${finalSecretKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'VerifyPayment/V2'
            },
            signal: AbortSignal.timeout(15000)
          }
        );

        const responseText = await paystackResponse.text();
        
        console.log('[VERIFY-PAYMENT-V2] API Response:', {
          reference,
          attempt,
          status: paystackResponse.status,
          statusText: paystackResponse.statusText,
          responseLength: responseText.length
        });

        if (!paystackResponse.ok) {
          const errorMessage = `Paystack API error: ${paystackResponse.status} - ${responseText}`;
          
          // Check if this is a retryable error (400 with "not found" or 404)
          const isRetryableError = 
            (paystackResponse.status === 400 && responseText.includes('Transaction reference not found')) ||
            (paystackResponse.status === 404);
          
          if (isRetryableError && attempt < maxRetries) {
            console.log(`[VERIFY-PAYMENT-V2] Retryable error, waiting before retry:`, { 
              reference, 
              attempt, 
              status: paystackResponse.status,
              isRetryableError 
            });
            lastError = errorMessage;
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
          
          console.error('[VERIFY-PAYMENT-V2] Non-retryable Paystack API error:', paystackResponse.status, responseText);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Payment verification failed',
              code: 'PAYSTACK_ERROR',
              details: errorMessage
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Try to parse the response
        try {
          paystackData = JSON.parse(responseText);
          break; // Success - exit retry loop
        } catch (parseError) {
          if (attempt < maxRetries) {
            console.log(`[VERIFY-PAYMENT-V2] JSON parse failed, retrying:`, { reference, attempt });
            lastError = `Invalid JSON response: ${parseError.message}`;
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            continue;
          }
          throw parseError;
        }

      } catch (error) {
        lastError = error.message;
        if (attempt < maxRetries) {
          console.log(`[VERIFY-PAYMENT-V2] Network error, retrying:`, { reference, attempt, error: error.message });
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        throw error;
      }
    }

    // If we exit the loop without success, return the last error
    if (!paystackData) {
      console.error('[VERIFY-PAYMENT-V2] All verification attempts failed:', lastError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification failed after retries',
          code: 'VERIFICATION_FAILED',
          details: lastError
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // paystackData is already parsed in the retry loop above

    if (!paystackData.status) {
      console.error('[VERIFY-PAYMENT-V2] Paystack verification failed:', paystackData.message)
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

    console.log('[VERIFY-PAYMENT-V2] Paystack verification response:', {
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

    console.log('[VERIFY-PAYMENT-V2] Payment confirmed, performing amount validation before update')

    // 🔒 AMOUNT VALIDATION: Get expected amount from order to verify against paid amount
    const paidAmountNaira = transaction.amount / 100; // Convert from kobo to Naira
    let expectedAmount: number | null = null;
    let amountMismatch = false;

    try {
      const { data: orderData } = await supabaseClient
        .from('orders')
        .select('total_amount, delivery_fee')
        .eq('payment_reference', reference)
        .single();

      if (orderData) {
        expectedAmount = (orderData.total_amount || 0) + (orderData.delivery_fee || 0);
        const amountDifference = Math.abs(paidAmountNaira - expectedAmount);
        amountMismatch = amountDifference > 0.01; // Allow 1 kobo tolerance for rounding

        console.log('[VERIFY-PAYMENT-V2] Amount validation:', {
          paid_amount: paidAmountNaira,
          expected_amount: expectedAmount,
          difference: amountDifference,
          is_mismatch: amountMismatch
        });

        if (amountMismatch) {
          // 🚨 SECURITY INCIDENT: Amount mismatch detected
          await supabaseClient.from('security_incidents').insert({
            type: 'payment_amount_mismatch',
            description: `Payment amount mismatch detected: paid ₦${paidAmountNaira}, expected ₦${expectedAmount}`,
            severity: 'critical',
            reference: reference,
            expected_amount: expectedAmount,
            received_amount: paidAmountNaira,
            created_at: new Date().toISOString()
          });

          console.error('[VERIFY-PAYMENT-V2] 🚨 CRITICAL SECURITY ALERT: Payment amount mismatch', {
            reference,
            paid_amount: paidAmountNaira,
            expected_amount: expectedAmount
          });

          // Update payment transaction with mismatch status
          await supabaseClient
            .from('payment_transactions')
            .upsert({
              provider_reference: reference,
              amount: paidAmountNaira,
              status: 'mismatch',
              gateway_response: `Amount mismatch: paid ₦${paidAmountNaira}, expected ₦${expectedAmount}`,
              metadata: transaction,
              processed_at: new Date().toISOString()
            }, {
              onConflict: 'provider_reference'
            });

          return new Response(
            JSON.stringify({
              success: false,
              payment_status: 'mismatch',
              error: 'Payment amount does not match order total',
              code: 'AMOUNT_MISMATCH',
              reference,
              paid_amount: paidAmountNaira,
              expected_amount: expectedAmount
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }
    } catch (amountCheckError) {
      console.warn('[VERIFY-PAYMENT-V2] Amount validation failed (non-critical):', amountCheckError);
      // Continue with verification if amount check fails
    }

    // Use the secure RPC to update order status
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      'verify_and_update_payment_status',
      {
        payment_ref: reference,
        new_status: 'confirmed',
        payment_amount: paidAmountNaira,
        payment_gateway_response: transaction
      }
    );

    if (rpcError) {
      console.error('[VERIFY-PAYMENT-V2] RPC failed:', rpcError);
      throw new Error(`Payment verification RPC failed: ${rpcError.message}`);
    }

    if (!rpcResult || rpcResult.length === 0) {
      console.error('[VERIFY-PAYMENT-V2] No order found for reference:', reference);
      
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
        
        console.log('[VERIFY-PAYMENT-V2] Created orphaned payment record')
      } catch (orphanError) {
        console.error('[VERIFY-PAYMENT-V2] Failed to create orphaned payment record:', orphanError)
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

    const orderResult = rpcResult[0];
    
    console.log('[VERIFY-PAYMENT-V2] Order updated successfully via RPC:', {
      orderNumber: orderResult.order_number,
      paymentStatus: 'paid',
      orderStatus: orderResult.status
    })

    // Create/update payment transaction record (non-blocking)
    try {
      await supabaseClient
        .from('payment_transactions')
        .upsert({
          provider_reference: transaction.reference,
          order_id: orderResult.order_id,
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
      
      console.log('[VERIFY-PAYMENT-V2] Payment transaction record updated')
    } catch (transactionError) {
      console.error('[VERIFY-PAYMENT-V2] Failed to update payment transaction:', transactionError)
      // Don't fail verification if transaction record update fails
    }

    // Trigger email processors to handle confirmation emails (non-blocking)
    try {
      await Promise.all([
        supabaseClient.functions.invoke('enhanced-email-processor', {
          headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
        }),
        supabaseClient.functions.invoke('instant-email-processor', {
          headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
        })
      ]);
      console.log('[VERIFY-PAYMENT-V2] Email processors triggered successfully');
    } catch (emailError) {
      console.log('[VERIFY-PAYMENT-V2] Failed to trigger email processors:', emailError);
      // Don't fail payment verification if email processing fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: transaction.status,
        reference: transaction.reference,
        order_id: orderResult.order_id,
        order_number: orderResult.order_number,
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
    console.error('[VERIFY-PAYMENT-V2] ERROR in verify-payment:', {
      message: error.message,
      stack: error.stack
    })
    
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
🔧 PRODUCTION-READY VERIFY-PAYMENT V2
- ✅ Uses secure RPC verify_and_update_payment_status instead of direct table updates
- ✅ No direct interaction with delivery_analytics or problematic triggers
- ✅ Enhanced error handling and logging with V2 tags
- ✅ Non-blocking email processing and transaction record updates
- ✅ Creates orphaned payment records for unmatched payments
- ✅ Uses SUPABASE_SERVICE_ROLE_KEY for all operations
- ✅ Comprehensive logging for debugging production issues
*/
