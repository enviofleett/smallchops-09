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

    // Choose correct secret key based on environment (test vs live)
    let primaryKey = config.test_mode 
      ? (config.secret_key as string)
      : ((config.live_secret_key as string) || (config.secret_key as string));
    let secondaryKey = config.test_mode 
      ? ((config.live_secret_key as string) || '')
      : ((config.secret_key as string) || '');
    if (!primaryKey) {
      throw new Error('Paystack secret key not configured');
    }

    // Function to perform verify call with a given key
    const performVerify = async (key: string) => {
      return await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });
    };

    // Verify with Paystack using primary key
    let paystackResponse = await performVerify(primaryKey);

    // If auth error, retry once with secondary key (handles wrong env key)
    if ((paystackResponse.status === 401 || paystackResponse.status === 403) && secondaryKey) {
      console.warn('paystack-verify: primary key unauthorized, retrying with secondary key');
      paystackResponse = await performVerify(secondaryKey);
    }

    if (!paystackResponse.ok) {
      const errText = await paystackResponse.text();
      throw new Error(`Verification HTTP ${paystackResponse.status}: ${errText}`);
    }

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
        .select(`
          order_id, 
          order:orders!inner(
            id, 
            customer_email, 
            customer_name, 
            order_number, 
            total_amount
          )
        `)
        .eq('provider_reference', reference)
        .single();

      if (transaction?.order_id) {
        // Update order status
        await supabaseClient
          .from('orders')
          .update({ 
            payment_status: 'paid',
            status: 'confirmed',
            updated_at: new Date()
          })
          .eq('id', transaction.order_id);

        // Link order to customer account if user is authenticated
        const orderData = transaction.order;
        if (orderData?.customer_email) {
          try {
            await supabaseClient.rpc('link_order_to_customer_account', {
              p_order_id: transaction.order_id,
              p_customer_email: orderData.customer_email
            });
            console.log('Order linked to customer account:', orderData.customer_email);
          } catch (linkError) {
            console.error('Failed to link order to customer account:', linkError);
            // Don't fail the payment verification if linking fails
          }
        }

        // Queue order confirmation emails using correct template keys
        if (orderData?.customer_email) {
          console.log('Queuing order confirmation emails for:', orderData.customer_email);
          
          // Get business settings for admin email and branding
          const { data: businessSettings } = await supabaseClient
            .from('business_settings')
            .select('admin_notification_email, email, name')
            .limit(1)
            .single();

          const adminEmail = businessSettings?.admin_notification_email || businessSettings?.email || 'admin@starters.com';
          const businessName = businessSettings?.name || 'Starters';

          const emailEvents = [
            // Customer order confirmation email
            {
              event_type: 'order_confirmation',
              recipient_email: orderData.customer_email,
              order_id: transaction.order_id,
              status: 'queued',
              template_key: 'order_confirmation',
              variables: {
                customer_name: orderData.customer_name || 'Valued Customer',
                order_id: transaction.order_id,
                total_amount: `₦${(data.amount / 100).toLocaleString()}`,
                business_name: businessName
              },
              priority: 'high'
            },
            // Payment confirmation email (separate from order confirmation)
            {
              event_type: 'payment_confirmation',
              recipient_email: orderData.customer_email,
              order_id: transaction.order_id,
              status: 'queued',
              template_key: 'payment_confirmation',
              variables: {
                customer_name: orderData.customer_name || 'Valued Customer',
                order_id: transaction.order_id,
                amount: `₦${(data.amount / 100).toLocaleString()}`,
                payment_reference: reference
              },
              priority: 'high'
            },
            // Admin order notification
            {
              event_type: 'admin_new_order',
              recipient_email: adminEmail,
              order_id: transaction.order_id,
              status: 'queued',
              template_key: 'admin_order_notification',
              variables: {
                order_id: transaction.order_id,
                customer_name: orderData.customer_name || 'Customer',
                customer_email: orderData.customer_email,
                total_amount: `₦${(data.amount / 100).toLocaleString()}`,
                item_count: 1
              },
              priority: 'high'
            }
          ];

          const { error: emailInsertError } = await supabaseClient
            .from('communication_events')
            .insert(emailEvents);

          if (emailInsertError) {
            console.error('Failed to queue order confirmation emails:', emailInsertError);
          } else {
            console.log(`Queued ${emailEvents.length} order confirmation emails successfully`);
            
            // Trigger multiple email processors for immediate processing with high priority
            try {
              console.log('Triggering enhanced email processor for high priority emails...');
              const enhancedResult = await supabaseClient.functions.invoke('enhanced-email-processor', {
                body: { priority: 'high' }
              });
              console.log('Enhanced email processor result:', enhancedResult);
              
              // Also trigger instant processor specifically for order confirmations
              console.log('Triggering instant email processor...');
              const instantResult = await supabaseClient.functions.invoke('instant-email-processor', {
                body: { priority: 'high' }
              });
              console.log('Instant email processor result:', instantResult);
              
              // For production reliability, also trigger production processor
              console.log('Triggering production email processor...');
              const productionResult = await supabaseClient.functions.invoke('production-email-processor', {
                body: { priority: 'high' }
              });
              console.log('Production email processor result:', productionResult);
              
            } catch (emailError) {
              console.error('Failed to trigger email processors:', emailError);
              
              // Critical fallback - try email automation trigger
              try {
                console.log('Using email automation trigger as critical fallback...');
                await supabaseClient.functions.invoke('email-automation-trigger', {
                  body: {
                    trigger_type: 'order_confirmation',
                    customer_email: orderData.customer_email,
                    customer_name: orderData.customer_name,
                    order_data: {
                      order_id: transaction.order_id,
                      order_number: orderData.order_number,
                      total_amount: data.amount / 100,
                      payment_date: new Date().toISOString()
                    },
                    immediate_processing: true
                  }
                });
                console.log('Email automation trigger executed successfully');
              } catch (fallbackError) {
                console.error('Critical: All email processors failed:', fallbackError);
              }
            }
          }
        }

        // Store order data for response
        data.metadata = {
          ...data.metadata,
          order_id: transaction.order_id,
          order_number: orderData.order_number,
          customer_name: orderData.customer_name
        };
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

    const isSuccess = data.status === 'success';

    return new Response(JSON.stringify({
      // Backward compatible shape
      status: true,
      data: verification.data,
      // New top-level helpers for clients
      success: isSuccess,
      order_id: data?.metadata?.order_id || null,
      order_number: data?.metadata?.order_number || null,
      amount: typeof data?.amount === 'number' ? data.amount / 100 : null,
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