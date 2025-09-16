import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Enhanced CORS headers for production reliability
function getCorsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, x-guest-session-id',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

interface VerifyPaymentRequest {
  reference: string;
  idempotency_key?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed - POST required' 
    }), { 
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

    // Process successful payment with updated RPC
    const amountNaira = paystackData.data.amount / 100; // Convert kobo to naira
    
    try {
      const { data: processResult, error: processError } = await supabase
        .rpc('verify_and_update_payment_status', {
          payment_ref: reference,
          new_status: 'confirmed',
          payment_amount: amountNaira,
          payment_gateway_response: paystackData.data
        });

      if (processError) {
        console.error('❌ Payment verification RPC failed:', processError);
        return new Response(JSON.stringify({
          success: false,
          error: processError.message || 'Payment processing failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle RPC result (can be object or array)
      let result;
      if (Array.isArray(processResult)) {
        result = processResult[0];
      } else {
        result = processResult;
      }
      
      if (!result) {
        throw new Error('No result from payment processing');
      }

      // Check if RPC returned error
      if (result.success === false) {
        console.error('❌ Payment processing failed:', result.error);
        return new Response(JSON.stringify({
          success: false,
          error: result.error || 'Payment processing failed'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ Payment verified and processed successfully:', {
        reference,
        orderId: result.order_id,
        orderNumber: result.order_number,
        status: result.status,
        payment_status: result.payment_status,
        amount: amountNaira,
        customer_email: paystackData.data.customer?.email
      });

      // ENHANCED: Use idempotent email confirmation
      try {
        console.log('📧 Creating payment confirmation event via RPC...');
        const { data: emailResult, error: emailError } = await supabase
          .rpc('upsert_payment_confirmation_event', {
            p_reference: reference,
            p_recipient_email: paystackData.data.customer?.email || 'unknown@example.com',
            p_order_id: result.order_id,
            p_template_variables: {
              customerName: paystackData.data.customer?.first_name || 'Customer',
              orderNumber: result.order_number,
              amount: amountNaira.toFixed(2),
              paymentMethod: paystackData.data.channel || 'Online Payment',
              paidAt: paystackData.data.paid_at
            }
          });

        if (emailError) {
          console.warn('⚠️  Email confirmation RPC failed (non-blocking):', emailError);
        } else if (emailResult?.existing) {
          console.log('📧 Email confirmation already exists (idempotent success)');
        } else {
          console.log('📧 Email confirmation created successfully');
        }
      } catch (emailError) {
        console.warn('⚠️  Email notification error (non-blocking):', emailError);
        // Don't fail the payment verification for email issues
      }

      // ENHANCED: Normalized success response with idempotency handling
      const successResponse = {
        success: true,
        status: 'success',
        amount: amountNaira,
        order_id: result.order_id,
        order_number: result.order_number,
        customer: paystackData.data.customer,
        channel: paystackData.data.channel,
        paid_at: paystackData.data.paid_at,
        // Enhanced data wrapper for consistency
        data: {
          order_id: result.order_id,
          order_number: result.order_number,
          amount: amountNaira,
          status: 'success',
          customer: paystackData.data.customer,
          reference: reference,
          verified_at: new Date().toISOString()
        }
      };

      console.log('✅ Returning success response:', { 
        reference, 
        order_id: result.order_id,
        amount: amountNaira 
      });

      return new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('❌ Critical verification error:', error);
      
      // ENHANCED: Check if this is a duplicate payment scenario
      const errorMessage = error.message || '';
      const isDuplicatePayment = errorMessage.includes('duplicate key') || 
                                errorMessage.includes('already exists') ||
                                errorMessage.includes('unique constraint');
      
      if (isDuplicatePayment) {
        console.log('🔄 Detected duplicate payment scenario - treating as success');
        
        // Return success for duplicate payments (idempotent behavior)
        const duplicateSuccessResponse = {
          success: true,
          status: 'success',
          amount: amountNaira,
          order_id: result?.order_id,
          order_number: result?.order_number,
          customer: paystackData.data.customer,
          channel: paystackData.data.channel,
          paid_at: paystackData.data.paid_at,
          data: {
            order_id: result?.order_id,
            order_number: result?.order_number,
            amount: amountNaira,
            status: 'success',
            customer: paystackData.data.customer,
            reference: reference,
            duplicate_handled: true,
            verified_at: new Date().toISOString()
          }
        };

        return new Response(JSON.stringify(duplicateSuccessResponse), {
          status: 200,
          headers: corsHeaders
        });
      }
      
      // Log critical error
      try {
        await supabase.from('audit_logs').insert({
          action: 'payment_verification_critical_error',
          category: 'Payment Critical',
          message: `Critical payment verification error: ${error.message}`,
          new_values: {
            reference,
            amount_naira: amountNaira,
            error: error.message,
            paystack_data: paystackData.data,
            is_duplicate: isDuplicatePayment
          }
        });
      } catch (logError) {
        console.error('Failed to log critical error:', logError);
      }

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