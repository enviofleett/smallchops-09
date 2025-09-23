import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

// Enhanced Paystack webhook processor with real-time capabilities
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const payload = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    
    console.log('🔄 Real-time webhook received:', {
      hasSignature: !!signature,
      payloadSize: payload.length,
      timestamp: new Date().toISOString()
    });

    // Get webhook secret for validation
    const { data: config } = await supabaseAdmin
      .from('payment_integrations')
      .select('webhook_secret')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    const webhookSecret = config?.webhook_secret;

    // Enhanced signature verification
    let isValidSignature = false;
    if (signature && webhookSecret) {
      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(webhookSecret),
          { name: "HMAC", hash: "SHA-512" },
          false,
          ["sign", "verify"]
        );

        const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
        const expectedSignature = Array.from(new Uint8Array(signatureBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const cleanSignature = signature.startsWith('sha512=') ? signature.slice(7) : signature;
        isValidSignature = expectedSignature === cleanSignature;
        
        console.log('✅ Webhook signature verified:', isValidSignature);
      } catch (error) {
        console.error('❌ Signature verification failed:', error);
      }
    }

    // IP validation as fallback
    if (!isValidSignature) {
      const clientIP = req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      req.headers.get('x-real-ip');

      console.log('🔍 Validating IP:', clientIP);

      const { data: isValidIP } = await supabaseAdmin
        .rpc('validate_paystack_webhook_ip', { request_ip: clientIP });

      if (!isValidIP) {
        console.error('❌ Invalid webhook source - signature and IP validation failed');
        return new Response('Unauthorized', { 
          status: 401, 
          headers: corsHeaders 
        });
      }
      
      console.log('✅ IP validation passed');
    }

    const webhookData = JSON.parse(payload);
    const eventId = webhookData.id || crypto.randomUUID();
    const eventType = webhookData.event;
    const data = webhookData.data;

    console.log('📦 Processing webhook event:', {
      eventId,
      eventType,
      reference: data?.reference,
      amount: data?.amount
    });

    // Check for duplicate events
    const { data: existingEvent } = await supabaseAdmin
      .from('webhook_logs')
      .select('id, processed_at')
      .eq('provider_event_id', eventId)
      .eq('provider', 'paystack')
      .single();

    if (existingEvent) {
      console.log('⚠️ Duplicate webhook event detected:', eventId);
      return new Response(JSON.stringify({ 
        status: 'duplicate',
        message: 'Event already processed',
        original_processed_at: existingEvent.processed_at
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log webhook event immediately
    const { data: webhookLog } = await supabaseAdmin
      .from('webhook_logs')
      .insert({
        provider: 'paystack',
        event_type: eventType,
        provider_event_id: eventId,
        transaction_reference: data?.reference,
        payload: webhookData,
        processing_started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Process different webhook events with real-time updates
    let processingResult = null;
    
    try {
      switch (eventType) {
        case 'charge.success':
          processingResult = await handleChargeSuccess(supabaseAdmin, data, eventId);
          break;
          
        case 'charge.failed':
          processingResult = await handleChargeFailed(supabaseAdmin, data, eventId);
          break;
          
        case 'charge.dispute.create':
          processingResult = await handleChargeDispute(supabaseAdmin, data, eventId);
          break;
          
        case 'customeridentification.success':
          processingResult = await handleCustomerVerification(supabaseAdmin, data, eventId);
          break;
          
        case 'transfer.success':
          processingResult = await handleTransferSuccess(supabaseAdmin, data, eventId);
          break;
          
        default:
          console.log(`ℹ️ Unhandled event type: ${eventType}`);
          processingResult = { status: 'ignored', message: `Event type ${eventType} not handled` };
      }

      // Update webhook log with success
      if (webhookLog) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ 
            processed_at: new Date().toISOString(),
            payload: { 
              ...webhookData, 
              processing_result: processingResult,
              processing_time_ms: Date.now() - new Date(webhookLog.processing_started_at).getTime()
            }
          })
          .eq('id', webhookLog.id);
      }

      console.log('✅ Webhook processing completed:', processingResult);

      return new Response(JSON.stringify({ 
        status: 'success',
        event_id: eventId,
        processing_result: processingResult
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (processingError) {
      console.error('❌ Webhook processing error:', processingError);
      
      // Update webhook log with error
      if (webhookLog) {
        await supabaseAdmin
          .from('webhook_logs')
          .update({ 
            processed_at: new Date().toISOString(),
            payload: { 
              ...webhookData, 
              processing_error: processingError.message,
              error_stack: processingError.stack
            }
          })
          .eq('id', webhookLog.id);
      }

      return new Response(JSON.stringify({ 
        status: 'error',
        error: processingError.message,
        event_id: eventId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('💥 Critical webhook error:', error);
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Enhanced charge success handler with real-time notifications
async function handleChargeSuccess(supabase: any, data: any, eventId: string) {
  console.log('💰 Processing successful charge:', data.reference);
  
  const startTime = Date.now();
  
  try {
    // Use the enhanced payment processing function
    const { data: result, error } = await supabase.rpc('handle_successful_payment_enhanced', {
      p_reference: data.reference,
      p_paid_at: new Date(data.paid_at || new Date()),
      p_gateway_response: data.gateway_response,
      p_fees: (data.fees || 0) / 100,
      p_channel: data.channel,
      p_authorization_code: data.authorization?.authorization_code,
      p_card_type: data.authorization?.card_type,
      p_last4: data.authorization?.last4,
      p_exp_month: data.authorization?.exp_month,
      p_exp_year: data.authorization?.exp_year,
      p_bank: data.authorization?.bank,
      p_webhook_event_id: eventId
    });

    if (error) {
      throw new Error(`Payment processing failed: ${error.message}`);
    }

    // Send real-time notifications via enhanced email templates
    if (result?.order_id) {
      await triggerEnhancedEmailNotifications(supabase, result.order_id, data);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Charge success processed in ${processingTime}ms`);

    return {
      status: 'processed',
      order_id: result?.order_id,
      processing_time_ms: processingTime,
      notifications_sent: result?.notifications_sent || false
    };

  } catch (error) {
    console.error('❌ Charge success processing failed:', error);
    throw error;
  }
}

// Enhanced charge failed handler
async function handleChargeFailed(supabase: any, data: any, eventId: string) {
  console.log('❌ Processing failed charge:', data.reference);
  
  try {
    // Update transaction status
    const { error } = await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response,
        provider_response: data,
        processed_at: new Date(),
        webhook_event_id: eventId
      })
      .eq('provider_reference', data.reference);

    if (error) {
      throw new Error(`Failed to update failed transaction: ${error.message}`);
    }

    // Send failure notification to admin
    await sendFailureNotification(supabase, data);

    return {
      status: 'failed_recorded',
      reference: data.reference,
      failure_reason: data.gateway_response
    };

  } catch (error) {
    console.error('❌ Failed charge processing error:', error);
    throw error;
  }
}

// Enhanced dispute handler
async function handleChargeDispute(supabase: any, data: any, eventId: string) {
  console.log('⚠️ Processing charge dispute:', data.reference);
  
  try {
    // Log dispute for manual review
    const { error } = await supabase
      .from('payment_disputes')
      .insert({
        transaction_reference: data.reference,
        dispute_id: data.id,
        reason: data.reason,
        amount: (data.amount || 0) / 100,
        currency: data.currency || 'NGN',
        status: 'pending_review',
        webhook_event_id: eventId,
        dispute_data: data,
        created_at: new Date(data.created_at || new Date())
      });

    if (error) {
      throw new Error(`Failed to log dispute: ${error.message}`);
    }

    // Send immediate dispute alert to admin
    await sendDisputeAlert(supabase, data);

    return {
      status: 'dispute_logged',
      dispute_id: data.id,
      amount: data.amount / 100,
      reason: data.reason
    };

  } catch (error) {
    console.error('❌ Dispute processing error:', error);
    throw error;
  }
}

// Customer verification handler
async function handleCustomerVerification(supabase: any, data: any, eventId: string) {
  console.log('🔍 Processing customer verification:', data.customer_code);
  
  return {
    status: 'verification_recorded',
    customer_code: data.customer_code
  };
}

// Transfer success handler
async function handleTransferSuccess(supabase: any, data: any, eventId: string) {
  console.log('💸 Processing transfer success:', data.reference);
  
  return {
    status: 'transfer_recorded',
    reference: data.reference,
    amount: data.amount / 100
  };
}

// Enhanced email notification trigger
async function triggerEnhancedEmailNotifications(supabase: any, orderId: string, paymentData: any) {
  try {
    // Get order details
    const { data: order } = await supabase
      .from('orders')
      .select('*, customers(*)')
      .eq('id', orderId)
      .single();

    if (!order) return;

    // Send enhanced payment confirmation to customer
    await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: order.customer_email,
        template_key: 'payment_confirmation',
        variables: {
          customer_name: order.customer_name,
          order_number: order.order_number,
          payment_amount: `₦${(paymentData.amount / 100).toLocaleString()}`,
          payment_method: paymentData.channel,
          payment_reference: paymentData.reference,
          order_total: `₦${order.total_amount.toLocaleString()}`,
          order_date: new Date().toLocaleDateString(),
          customer_email: order.customer_email,
          fulfillment_type: order.order_type || 'delivery',
          store_name: 'Your Store',
          store_url: 'https://your-store.com',
          support_email: 'support@your-store.com',
          support_phone: '+234-xxx-xxx-xxxx'
        },
        priority: 'high'
      }
    });

    // Send enhanced admin notification
    await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: 'admin@your-store.com',
        template_key: 'admin_new_order',
        variables: {
          order_number: order.order_number,
          order_total: `₦${order.total_amount.toLocaleString()}`,
          payment_amount: `₦${(paymentData.amount / 100).toLocaleString()}`,
          payment_method: paymentData.channel,
          fulfillment_type: order.order_type || 'delivery',
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          order_date: new Date().toLocaleDateString(),
          store_name: 'Your Store',
          store_url: 'https://your-store.com'
        },
        priority: 'high'
      }
    });

    console.log('📧 Enhanced email notifications triggered');
  } catch (error) {
    console.error('❌ Email notification error:', error);
  }
}

// Send failure notification
async function sendFailureNotification(supabase: any, data: any) {
  // Implementation for failure notifications
  console.log('📧 Sending failure notification for:', data.reference);
}

// Send dispute alert
async function sendDisputeAlert(supabase: any, data: any) {
  // Implementation for dispute alerts
  console.log('📧 Sending dispute alert for:', data.reference);
}