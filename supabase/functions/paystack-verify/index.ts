import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PaymentValidator } from "../_shared/payment-validators.ts";
import { DistributedRateLimiter } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Enhanced rate limiting for verification
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    
    const rateLimitCheck = await DistributedRateLimiter.checkPaymentRateLimit(
      `verify:${clientIP}`, 
      'verify'
    );
    
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Too many verification attempts. Please wait before trying again.',
        retryAfter: rateLimitCheck.retryAfter
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': rateLimitCheck.retryAfter?.toString() || '60'
        },
      });
    }

    const { reference } = await req.json();
    
    // Enhanced reference validation
    const refValidation = PaymentValidator.validatePaymentReference(reference);
    if (!refValidation.isValid) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Invalid payment reference format',
        details: refValidation.errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get Paystack configuration
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (!config) {
      throw new Error('Paystack not configured');
    }

    // Verify with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${config.secret_key}`,
      }
    });

    const verification = await paystackResponse.json();

    if (!verification.status) {
      throw new Error(verification.message || 'Verification failed');
    }

    const data = verification.data;

    // Update local transaction
    const updateData = {
      status: data.status === 'success' ? 'success' : 'failed',
      gateway_response: data.gateway_response,
      paid_at: data.paid_at ? new Date(data.paid_at) : null,
      fees: data.fees ? data.fees / 100 : 0,
      channel: data.channel,
      payment_method: data.authorization?.channel,
      authorization_code: data.authorization?.authorization_code,
      card_type: data.authorization?.card_type,
      last4: data.authorization?.last4,
      exp_month: data.authorization?.exp_month,
      exp_year: data.authorization?.exp_year,
      bank: data.authorization?.bank,
      account_name: data.authorization?.account_name,
    };

    const { error } = await supabaseClient
      .from('payment_transactions')
      .update(updateData)
      .eq('provider_reference', reference);

    if (error) {
      throw new Error('Failed to update transaction');
    }

    // Save payment method if successful and has authorization
    if (data.status === 'success' && data.authorization?.authorization_code) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: userData } = await supabaseClient.auth.getUser(token);
        
        if (userData.user) {
          await supabaseClient
            .from('saved_payment_methods')
            .upsert({
              user_id: userData.user.id,
              provider: 'paystack',
              authorization_code: data.authorization.authorization_code,
              card_type: data.authorization.card_type,
              last4: data.authorization.last4,
              exp_month: data.authorization.exp_month,
              exp_year: data.authorization.exp_year,
              bank: data.authorization.bank,
            }, { onConflict: 'authorization_code' });
        }
      }
    }

    // Update order status if payment successful
    if (data.status === 'success') {
      const { data: transaction } = await supabaseClient
        .from('payment_transactions')
        .select('order_id, order:orders!inner(customer_email)')
        .eq('provider_reference', reference)
        .single();

      if (transaction?.order_id) {
        await supabaseClient
          .from('orders')
          .update({ 
            payment_status: 'paid',
            status: 'confirmed',
            updated_at: new Date()
          })
          .eq('id', transaction.order_id);

        // Queue payment confirmation email
        const customerEmail = transaction.order?.customer_email;
        if (customerEmail) {
          console.log('Queuing payment confirmation email for:', customerEmail);
          
          // Insert payment confirmation email into communication_events
          const { error: emailInsertError } = await supabaseClient
            .from('communication_events')
            .insert({
              event_type: 'payment_confirmation',
              recipient_email: customerEmail,
              status: 'queued',
              priority: 'high',
              template_data: {
                order_id: transaction.order_id,
                order_number: data.metadata?.order_number,
                amount: data.amount / 100, // Convert from kobo
                payment_reference: reference,
                customer_name: data.metadata?.customer_name
              },
              retry_count: 0
            });

          if (emailInsertError) {
            console.error('Failed to queue payment confirmation email:', emailInsertError);
          } else {
            console.log('Payment confirmation email queued successfully');
          }
        }

        // Trigger email processing for payment confirmation emails
        try {
          console.log('Triggering email processor for payment confirmation...');
          await supabaseClient.functions.invoke('enhanced-email-processor', {
            body: { priority: 'high', event_type: 'payment_confirmation' }
          });
          console.log('Email processor triggered successfully after payment verification');
        } catch (emailError) {
          console.error('Failed to trigger email processor after payment:', emailError);
          // Don't fail the verification for email errors
        }
      }
    }

    // Log successful verification with sanitized data
    const sanitizedLog = PaymentValidator.sanitizeForLogging({
      reference,
      amount: verification.data.amount,
      status: verification.data.status,
      timestamp: new Date().toISOString()
    });
    
    console.log('Payment verified successfully:', sanitizedLog);

    return new Response(JSON.stringify({
      status: true,
      data: verification.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Paystack verification error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});