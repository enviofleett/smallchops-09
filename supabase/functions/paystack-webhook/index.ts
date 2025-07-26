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

    // Log webhook event
    await supabaseClient
      .from('webhook_logs')
      .insert({
        provider: 'paystack',
        event_type: event.event,
        provider_event_id: event.id,
        transaction_reference: event.data?.reference,
        payload: event
      });

    // Process different event types
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(supabaseClient, event.data);
        break;
      case 'charge.failed':
        await handleChargeFailed(supabaseClient, event.data);
        break;
      default:
        console.log(`Unhandled event type: ${event.event}`);
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

async function handleChargeFailed(supabaseClient: any, data: any) {
  await supabaseClient
    .from('payment_transactions')
    .update({
      status: 'failed',
      gateway_response: data.gateway_response
    })
    .eq('provider_reference', data.reference);
}