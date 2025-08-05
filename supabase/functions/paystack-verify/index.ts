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
        await supabaseClient
          .from('orders')
          .update({ 
            payment_status: 'paid',
            status: 'confirmed',
            updated_at: new Date()
          })
          .eq('id', transaction.order_id);

        // Queue order confirmation emails using correct template keys
        const orderData = transaction.order;
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
              template_key: 'order_confirmation_clean',
              template_variables: {
                customerName: orderData.customer_name || 'Valued Customer',
                orderId: orderData.order_number || transaction.order_id,
                orderDate: new Date().toLocaleDateString(),
                orderTotal: `₦${(data.amount / 100).toLocaleString()}`,
                orderItems: `Payment Amount: ₦${(data.amount / 100).toLocaleString()}`,
                deliveryAddress: 'As specified in your order',
                companyName: businessName,
                supportEmail: businessSettings?.email || 'support@starters.com'
              },
              priority: 'high'
            },
            // Admin order notification
            {
              event_type: 'admin_new_order',
              recipient_email: adminEmail,
              order_id: transaction.order_id,
              status: 'queued',
              template_key: 'admin_new_order',
              template_variables: {
                orderNumber: orderData.order_number || transaction.order_id,
                customerName: orderData.customer_name || 'Customer',
                customerEmail: orderData.customer_email,
                orderTotal: `₦${(data.amount / 100).toLocaleString()}`,
                orderDate: new Date().toLocaleDateString(),
                itemsCount: 1,
                orderId: transaction.order_id,
                adminDashboardLink: 'https://yourdomain.com/admin/orders'
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
            
            // Trigger multiple email processors for immediate processing
            try {
              console.log('Triggering enhanced email processor...');
              await supabaseClient.functions.invoke('enhanced-email-processor');
              console.log('Enhanced email processor triggered successfully');
              
              // Also trigger instant processor for high priority
              await supabaseClient.functions.invoke('instant-email-processor');
              console.log('Instant email processor triggered successfully');
            } catch (emailError) {
              console.error('Failed to trigger email processors:', emailError);
              
              // Fallback to production processor
              try {
                await supabaseClient.functions.invoke('production-email-processor');
                console.log('Production email processor triggered as fallback');
              } catch (fallbackError) {
                console.error('All email processors failed:', fallbackError);
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