import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Create Supabase client once (service role)
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Paystack secure function called');
    const requestBody = await req.json();
    const { action, ...requestData } = requestBody || {};

    if (action === 'initialize') {
      return await initializePayment(requestData);
    } else if (action === 'verify') {
      return await verifyPayment(requestData);
    } else {
      return new Response(JSON.stringify({ status: false, error: 'Invalid action specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('Paystack secure operation error:', error);
    return new Response(JSON.stringify({ status: false, error: 'Operation failed', message: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper to parse metadata to object safely
function parseMetadata(input: unknown): Record<string, any> {
  if (!input) return {};
  try {
    if (typeof input === 'string') return JSON.parse(input);
    if (typeof input === 'object') return input as Record<string, any>;
  } catch (_) {}
  return {};
}

async function initializePayment(requestData: any) {
  try {
    // Ignore reference from frontend; always generate server reference
    const { email, amount, channels, metadata, callback_url } = requestData || {};

    if (!email || amount === undefined || amount === null) {
      throw new Error('Email and amount are required');
    }

    const amountInKobo = Math.round(parseFloat(String(amount)));
    if (isNaN(amountInKobo) || amountInKobo < 100) {
      throw new Error('Amount must be >= 100 kobo (₦1.00)');
    }

    // Load Paystack config directly from table (connected row)
    const { data: config, error: configError } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (configError || !config) {
      console.error('Paystack configuration error:', configError);
      throw new Error('Paystack not configured properly');
    }

    const secretKey: string | null = config.test_mode ? config.secret_key : (config.live_secret_key || config.secret_key);
    if (!secretKey) {
      const mode = config.test_mode ? 'test' : 'live';
      throw new Error(`Paystack ${mode} secret key not configured`);
    }

    const transactionRef = `txn_${Date.now()}_${crypto.randomUUID()}`;
    console.log(`✅ Server-generated reference: ${transactionRef}`);

    const paystackPayload: Record<string, any> = {
      email,
      amount: amountInKobo.toString(),
      currency: 'NGN',
      reference: transactionRef,
      channels: channels || ['card', 'bank_transfer', 'ussd'],
      metadata: JSON.stringify(metadata || {}),
      ...(callback_url ? { callback_url } : {})
    };

    console.log('🚀 Sending to Paystack initialize:', JSON.stringify({ ...paystackPayload, metadata: '[stringified]' }));

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(paystackPayload)
    });

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('❌ Paystack HTTP error:', paystackResponse.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Paystack API error (${paystackResponse.status}): ${errorJson.message || errorText}`);
      } catch (_) {
        throw new Error(`Paystack API error (${paystackResponse.status}): ${errorText}`);
      }
    }

    const paystackData = await paystackResponse.json();
    if (!paystackData?.status) {
      console.error('❌ Paystack initialization failed:', paystackData);
      throw new Error(paystackData?.message || 'Failed to initialize payment');
    }

    const returnedRef: string = paystackData.data?.reference || transactionRef;

    // Persist reference for consistency (best-effort, non-blocking errors)
    try {
      const metaObj = parseMetadata(metadata);
      let orderId: string | null = metaObj.order_id || metaObj.orderId || null;
      const orderNumber: string | null = metaObj.order_number || metaObj.orderNumber || null;

      // Resolve order id by number if needed
      if (!orderId && orderNumber) {
        const { data: orderByNumber } = await supabaseClient
          .from('orders')
          .select('id')
          .eq('order_number', orderNumber)
          .maybeSingle();
        if (orderByNumber?.id) orderId = orderByNumber.id;
      }

      // Update order payment_reference when resolvable
      if (orderId) {
        const { error: orderErr } = await supabaseClient
          .from('orders')
          .update({ payment_reference: returnedRef, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (orderErr) console.warn('Order payment_reference update failed:', orderErr);
      }

      // Seed a pending transaction so verification can find it
      const txInsert: any = {
        order_id: orderId,
        provider: 'paystack',
        provider_reference: returnedRef,
        amount: amountInKobo / 100, // store in NGN
        currency: 'NGN',
        status: 'pending',
        metadata: metaObj || {},
        customer_email: email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error: insertErr } = await supabaseClient.from('payment_transactions').insert(txInsert);
      if (insertErr) console.warn('Pending transaction insert failed:', insertErr);

      // Audit trail (best-effort)
      await supabaseClient.from('audit_logs').insert({
        action: 'payment_initialized',
        category: 'Payment',
        message: `Initialized Paystack payment: ${returnedRef}`,
        new_values: { reference: returnedRef, order_id: orderId, amount_ngn: amountInKobo / 100 }
      });
    } catch (e) {
      console.warn('Initialization persistence warning:', e);
    }

    return new Response(JSON.stringify({
      status: true,
      data: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: returnedRef
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    return new Response(JSON.stringify({ status: false, error: error?.message || 'Failed to initialize payment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function verifyPayment(requestData: any) {
  try {
    const { reference } = requestData || {};
    if (!reference) throw new Error('Payment reference is required');

    // Load Paystack config
    const { data: config, error: configError } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (configError || !config) throw new Error('Paystack not configured properly');

    const secretKey: string | null = config.test_mode ? config.secret_key : (config.live_secret_key || config.secret_key);
    if (!secretKey) {
      const mode = config.test_mode ? 'test' : 'live';
      throw new Error(`Paystack ${mode} secret key not configured`);
    }

    console.log('Verifying Paystack payment:', reference);

    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
    });

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('❌ Paystack verification HTTP error:', paystackResponse.status, errorText);
      throw new Error(`Paystack verification failed (${paystackResponse.status}): ${errorText}`);
    }

    const paystackData = await paystackResponse.json();
    if (!paystackData?.status) {
      console.error('Paystack verification failed:', paystackData);
      throw new Error(paystackData?.message || 'Failed to verify payment');
    }

    const tx = paystackData.data || {};

    // Persist verification outcome (best-effort) and let DB triggers/RPC handle order updates
    try {
      let metadataObj = parseMetadata(tx.metadata);
      let orderId: string | null = metadataObj.order_id || metadataObj.orderId || null;
      const orderNumber: string | null = metadataObj.order_number || metadataObj.orderNumber || null;

      // Resolve order id by payment_reference or number if needed
      if (!orderId) {
        const { data: byRef } = await supabaseClient
          .from('orders')
          .select('id')
          .or(`payment_reference.eq.${reference},id.eq.${reference}`)
          .maybeSingle();
        if (byRef?.id) orderId = byRef.id;
      }
      if (!orderId && orderNumber) {
        const { data: byNum } = await supabaseClient
          .from('orders')
          .select('id')
          .eq('order_number', orderNumber)
          .maybeSingle();
        if (byNum?.id) orderId = byNum.id;
      }

      const isSuccess = tx.status === 'success';
      const baseUpdate: any = {
        provider_reference: reference,
        transaction_type: 'charge',
        status: isSuccess ? 'paid' : tx.status || 'failed',
        amount: typeof tx.amount === 'number' ? tx.amount / 100 : null,
        currency: tx.currency || 'NGN',
        channel: tx.channel || 'online',
        gateway_response: tx.gateway_response || null,
        paid_at: tx.paid_at || new Date().toISOString(),
        customer_email: tx?.customer?.email || null,
        provider_response: tx || null,
        updated_at: new Date().toISOString()
      };
      const payload = orderId ? { ...baseUpdate, order_id: orderId } : baseUpdate;

      // Upsert by provider_reference when possible; if not, fallback to insert/update sequence
      let upsertError: any = null;
      try {
        const { error } = await supabaseClient
          .from('payment_transactions')
          .upsert(payload, { onConflict: 'provider_reference' });
        upsertError = error;
      } catch (e) {
        upsertError = e;
      }

      if (upsertError) {
        // Fallback: try to find and update
        const { data: existing } = await supabaseClient
          .from('payment_transactions')
          .select('id')
          .eq('provider_reference', reference)
          .maybeSingle();
        if (existing?.id) {
          await supabaseClient
            .from('payment_transactions')
            .update(payload)
            .eq('id', existing.id);
        } else {
          await supabaseClient.from('payment_transactions').insert({ ...payload, created_at: new Date().toISOString() });
        }
      }

      // Call RPC to finalize (updates orders, saves cards, logs)
      try {
        const { error: rpcError } = await supabaseClient.rpc('handle_successful_payment', {
          p_reference: reference,
          p_paid_at: baseUpdate.paid_at,
          p_gateway_response: baseUpdate.gateway_response,
          p_fees: tx.fees ?? 0,
          p_channel: baseUpdate.channel,
          p_authorization_code: tx?.authorization?.authorization_code ?? null,
          p_card_type: tx?.authorization?.card_type ?? null,
          p_last4: tx?.authorization?.last4 ?? null,
          p_exp_month: tx?.authorization?.exp_month ?? null,
          p_exp_year: tx?.authorization?.exp_year ?? null,
          p_bank: tx?.authorization?.bank ?? null,
        });
        if (rpcError) console.warn('handle_successful_payment RPC returned error:', rpcError);
      } catch (e) {
        console.warn('handle_successful_payment RPC crashed:', e);
      }

      // Ensure orders table has reference (idempotent)
      if (orderId) {
        await supabaseClient
          .from('orders')
          .update({ payment_reference: reference, updated_at: new Date().toISOString() })
          .eq('id', orderId);
      }

      // Audit
      await supabaseClient.from('audit_logs').insert({
        action: 'payment_verified',
        category: 'Payment',
        message: `Paystack verified: ${reference}`,
        new_values: { order_id: orderId, status: tx.status }
      });
    } catch (e) {
      console.warn('Verification persistence warning:', e);
    }

    return new Response(JSON.stringify({
      status: true,
      data: {
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        customer: tx.customer,
        metadata: tx.metadata,
        paid_at: tx.paid_at,
        channel: tx.channel,
        gateway_response: tx.gateway_response
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return new Response(JSON.stringify({ status: false, error: error?.message || 'Failed to verify payment' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
