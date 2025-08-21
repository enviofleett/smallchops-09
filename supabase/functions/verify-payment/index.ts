
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  reference: string;
  order_id?: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  order_id?: string;
  order_number?: string;
  payment_status?: string;
  order_status?: string;
  amount?: number;
  paid_at?: string;
  channel?: string;
  reference?: string;
  gateway_response?: string;
  customer_email?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { reference, order_id }: VerifyPaymentRequest = await req.json();

    console.log('[VERIFY-PAYMENT-V3] Payment verification started', {
      reference,
      order_id: order_id || 'not_provided'
    });

    if (!reference) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment reference is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Paystack secret key from environment or database config
    let paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    
    if (!paystackSecretKey) {
      try {
        const { data: config } = await supabase.rpc('get_active_paystack_config');
        const effective = Array.isArray(config) ? config[0] : config;
        paystackSecretKey = effective?.secret_key;
      } catch (e) {
        console.warn('[VERIFY-PAYMENT-V3] Failed to get DB config:', e);
      }
    }

    if (!paystackSecretKey) {
      console.error('[VERIFY-PAYMENT-V3] No Paystack secret key available');
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment service configuration error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[VERIFY-PAYMENT-V3] Using secret key:', paystackSecretKey.substring(0, 10) + '...');

    // Verify with Paystack API
    console.log('[VERIFY-PAYMENT-V3] Verifying payment with Paystack:', { reference });

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!verifyResponse.ok) {
      console.error('[VERIFY-PAYMENT-V3] Paystack API error:', verifyResponse.status);
      return new Response(JSON.stringify({
        success: false,
        error: `Paystack verification failed: ${verifyResponse.status}`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const paystackData = await verifyResponse.json();
    const paymentData = paystackData?.data;

    console.log('[VERIFY-PAYMENT-V3] Paystack verification response:', {
      status: paymentData?.status,
      amount: paymentData?.amount,
      reference: paymentData?.reference,
      gateway_response: paymentData?.gateway_response
    });

    if (paystackData?.status && paymentData?.status === 'success') {
      console.log('[VERIFY-PAYMENT-V3] Payment confirmed, updating database');

      const paidAmountNaira = paymentData.amount / 100; // Convert from kobo

      // Use the updated RPC function that properly casts return types
      try {
        const { data: updateResult, error: updateError } = await supabase
          .rpc('verify_and_update_payment_status', {
            payment_ref: reference,
            new_status: 'confirmed',
            payment_amount: paidAmountNaira
          });

        if (updateError) {
          console.error('[VERIFY-PAYMENT-V3] RPC failed:', updateError);
          throw new Error(`Payment verification RPC failed: ${updateError.message}`);
        }

        if (!updateResult || updateResult.length === 0) {
          throw new Error('No order found for payment reference');
        }

        const orderResult = Array.isArray(updateResult) ? updateResult[0] : updateResult;

        console.log('[VERIFY-PAYMENT-V3] Payment verified successfully:', {
          order_id: orderResult.order_id,
          order_number: orderResult.order_number,
          amount: orderResult.amount
        });

        // Create/update payment transaction record
        await supabase
          .from('payment_transactions')
          .upsert({
            reference: reference,
            provider_reference: reference,
            order_id: orderResult.order_id,
            provider: 'paystack',
            amount: paidAmountNaira,
            currency: paymentData.currency || 'NGN',
            status: 'paid',
            customer_email: paymentData.customer?.email,
            gateway_response: paymentData,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'reference'
          });

        return new Response(JSON.stringify({
          success: true,
          order_id: orderResult.order_id,
          order_number: orderResult.order_number,
          payment_status: 'paid',
          order_status: orderResult.status,
          amount: paidAmountNaira,
          paid_at: paymentData.paid_at,
          channel: paymentData.channel,
          reference: reference,
          gateway_response: paymentData.gateway_response,
          customer_email: orderResult.customer_email
        } as VerifyPaymentResponse), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (rpcError: any) {
        console.error('[VERIFY-PAYMENT-V3] Database update failed:', rpcError);
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Payment verified with Paystack but database update failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } else if (paymentData?.status === 'failed') {
      console.log('[VERIFY-PAYMENT-V3] Payment failed');
      
      return new Response(JSON.stringify({
        success: false,
        error: paymentData?.gateway_response || 'Payment failed',
        reference: reference
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      console.log('[VERIFY-PAYMENT-V3] Payment still pending');
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment not completed yet. Please try again.',
        reference: reference
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('[VERIFY-PAYMENT-V3] ERROR in verify-payment:', {
      message: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Payment verification failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
