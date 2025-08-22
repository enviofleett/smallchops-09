import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  reference: string;
  idempotency_key?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { reference, idempotency_key }: VerifyPaymentRequest = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment reference is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Verifying payment:', { reference, idempotency_key });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Paystack configuration
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment service not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already processed using idempotency
    if (idempotency_key) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, customer_email')
        .eq('idempotency_key', idempotency_key)
        .single();

      if (existingOrder && existingOrder.status === 'confirmed') {
        console.log('✅ Payment already verified via idempotency:', idempotency_key);
        return new Response(JSON.stringify({
          success: true,
          status: 'success',
          amount: existingOrder.total_amount,
          order_id: existingOrder.id,
          order_number: existingOrder.order_number,
          customer_email: existingOrder.customer_email,
          message: 'Payment already verified'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Verify with Paystack API
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!paystackResponse.ok) {
      console.error('❌ Paystack verification failed:', paystackResponse.statusText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment verification failed' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const paystackData = await paystackResponse.json();
    
    console.log('📨 Paystack verification response:', {
      status: paystackData.status,
      paymentStatus: paystackData.data?.status,
      amount: paystackData.data?.amount,
      reference: paystackData.data?.reference
    });

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return new Response(JSON.stringify({
        success: false,
        status: paystackData.data?.status || 'failed',
        error: 'Payment not successful'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process successful payment atomically
    const amountKobo = paystackData.data.amount;
    const generatedIdempotencyKey = idempotency_key || 
      `verify_${reference}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { data: processResult, error: processError } = await supabase
        .rpc('process_payment_atomically', {
          p_payment_reference: reference,
          p_idempotency_key: generatedIdempotencyKey,
          p_amount_kobo: amountKobo,
          p_status: 'confirmed'
        });

      if (processError) {
        console.error('❌ Atomic payment processing failed:', processError);
        return new Response(JSON.stringify({
          success: false,
          error: processError.message || 'Payment processing failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = processResult?.[0];
      if (!result) {
        throw new Error('No result from payment processing');
      }

      console.log('✅ Payment verified and processed:', {
        reference,
        orderId: result.order_id,
        orderNumber: result.order_number,
        amountVerified: result.amount_verified
      });

      // Trigger email confirmation
      try {
        await supabase.from('communication_events').insert({
          order_id: result.order_id,
          event_type: 'payment_verified',
          recipient_email: paystackData.data.customer?.email,
          template_key: 'payment_confirmation',
          status: 'queued',
          variables: {
            customerName: paystackData.data.customer?.first_name || 'Customer',
            orderNumber: result.order_number,
            amount: (amountKobo / 100).toFixed(2),
            paymentMethod: paystackData.data.channel || 'Online Payment',
            paidAt: paystackData.data.paid_at
          }
        });
      } catch (emailError) {
        console.warn('⚠️  Email notification failed:', emailError);
        // Don't fail the payment verification for email issues
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'success',
        amount: amountKobo / 100, // Convert kobo to naira
        order_id: result.order_id,
        order_number: result.order_number,
        customer: paystackData.data.customer,
        channel: paystackData.data.channel,
        paid_at: paystackData.data.paid_at,
        amount_verified: result.amount_verified
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ Critical verification error:', error);
      
      // Log critical error
      await supabase.from('audit_logs').insert({
        action: 'payment_verification_critical_error',
        category: 'Payment Critical',
        message: `Critical payment verification error: ${error.message}`,
        new_values: {
          reference,
          amount_kobo: amountKobo,
          error: error.message,
          paystack_data: paystackData.data
        }
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Critical payment processing error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Payment verification failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});