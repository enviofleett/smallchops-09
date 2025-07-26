import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
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

    const payload = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      throw new Error('Missing Paystack signature');
    }

    // Get webhook secret from database
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('webhook_secret')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (!config?.webhook_secret) {
      throw new Error('Webhook secret not configured');
    }

    // Verify webhook signature using crypto.subtle
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(config.webhook_secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Remove 'sha512=' prefix if present in signature
    const cleanSignature = signature.startsWith('sha512=') ? signature.slice(7) : signature;
    
    if (expectedSignature !== cleanSignature) {
      console.error('Signature mismatch:', { expected: expectedSignature, received: cleanSignature });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const event = JSON.parse(payload);

    // Check for replay attacks (events older than 5 minutes)
    const eventTime = new Date(event.created_at || event.data?.created_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (eventTime < fiveMinutesAgo) {
      console.error('Webhook replay attack detected:', { eventTime, received: new Date() });
      return new Response(JSON.stringify({ error: 'Event too old' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check for duplicate events
    const { data: existingEvent } = await supabaseClient
      .from('webhook_logs')
      .select('id')
      .eq('provider_event_id', event.id)
      .eq('provider', 'paystack')
      .single();

    if (existingEvent) {
      console.log('Duplicate webhook event received:', event.id);
      return new Response(JSON.stringify({ status: 'duplicate_processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Log webhook event before processing
    const { data: webhookLog, error: logError } = await supabaseClient
      .from('webhook_logs')
      .insert({
        provider: 'paystack',
        event_type: event.event,
        provider_event_id: event.id,
        transaction_reference: event.data?.reference,
        payload: event,
        processed_at: new Date()
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log webhook event:', logError);
      // Continue processing even if logging fails
    }

    // Process different event types with error handling
    try {
      switch (event.event) {
        case 'charge.success':
          await handleChargeSuccess(supabaseClient, event.data);
          break;
        case 'charge.failed':
          await handleChargeFailed(supabaseClient, event.data);
          break;
        case 'charge.dispute.create':
          await handleChargeDispute(supabaseClient, event.data);
          break;
        default:
          console.log(`Unhandled event type: ${event.event}`);
      }

      // Update webhook log as processed successfully
      if (webhookLog) {
        await supabaseClient
          .from('webhook_logs')
          .update({ processed_at: new Date() })
          .eq('id', webhookLog.id);
      }

    } catch (processingError) {
      console.error('Webhook processing error:', processingError);
      
      // Update webhook log with error
      if (webhookLog) {
        await supabaseClient
          .from('webhook_logs')
          .update({ 
            processed_at: new Date(),
            payload: { ...event, processing_error: processingError.message }
          })
          .eq('id', webhookLog.id);
      }

      return new Response(JSON.stringify({ 
        error: 'Event processing failed',
        event_id: event.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function handleChargeSuccess(supabaseClient: any, data: any) {
  const updateData = {
    status: 'success',
    paid_at: new Date(data.paid_at),
    gateway_response: data.gateway_response,
    fees: data.fees / 100,
    channel: data.channel
  };

  await supabaseClient
    .from('payment_transactions')
    .update(updateData)
    .eq('provider_reference', data.reference);

  // Update order status
  const { data: transaction } = await supabaseClient
    .from('payment_transactions')
    .select('order_id')
    .eq('provider_reference', data.reference)
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
  }
}

async function handleChargeSuccess(supabaseClient: any, data: any) {
  try {
    // Use transaction for data consistency
    const { error: transactionError } = await supabaseClient.rpc('handle_successful_payment', {
      p_reference: data.reference,
      p_paid_at: new Date(data.paid_at),
      p_gateway_response: data.gateway_response,
      p_fees: data.fees / 100,
      p_channel: data.channel,
      p_authorization_code: data.authorization?.authorization_code,
      p_card_type: data.authorization?.card_type,
      p_last4: data.authorization?.last4,
      p_exp_month: data.authorization?.exp_month,
      p_exp_year: data.authorization?.exp_year,
      p_bank: data.authorization?.bank
    });

    if (transactionError) {
      throw new Error(`Database transaction failed: ${transactionError.message}`);
    }

    console.log(`Successfully processed charge success for reference: ${data.reference}`);
  } catch (error) {
    console.error('Error handling charge success:', error);
    throw error;
  }
}

async function handleChargeFailed(supabaseClient: any, data: any) {
  try {
    const { error } = await supabaseClient
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response,
        processed_at: new Date()
      })
      .eq('provider_reference', data.reference);

    if (error) {
      throw new Error(`Failed to update failed transaction: ${error.message}`);
    }

    console.log(`Successfully processed charge failure for reference: ${data.reference}`);
  } catch (error) {
    console.error('Error handling charge failure:', error);
    throw error;
  }
}

async function handleChargeDispute(supabaseClient: any, data: any) {
  try {
    // Log dispute for manual review
    const { error } = await supabaseClient
      .from('payment_disputes')
      .insert({
        transaction_reference: data.reference,
        dispute_id: data.id,
        reason: data.reason,
        amount: data.amount / 100,
        currency: data.currency,
        status: 'pending_review',
        created_at: new Date(data.created_at)
      });

    if (error) {
      throw new Error(`Failed to log payment dispute: ${error.message}`);
    }

    console.log(`Successfully logged dispute for reference: ${data.reference}`);
  } catch (error) {
    console.error('Error handling charge dispute:', error);
    throw error;
  }
}