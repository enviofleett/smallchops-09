import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Service-role client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

type ReconcileBody = {
  action: 'reconcile_single';
  reference: string; // expected canonical txn_* reference
  order_number?: string;
  order_id?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<ReconcileBody> | null;
    if (!body || body.action !== 'reconcile_single') {
      return jsonResponse({ status: false, error: 'Invalid action' }, 400);
    }

    const inputRef = (body.reference || '').trim();
    if (!inputRef) {
      return jsonResponse({ status: false, error: 'Missing reference' }, 400);
    }

    // Load Paystack configuration
    const { data: cfg, error: cfgErr } = await supabase
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();
    if (cfgErr || !cfg) {
      console.error('Config error:', cfgErr);
      return jsonResponse({ status: false, error: 'Paystack not configured' }, 500);
    }

    const secretKey: string | null = cfg.test_mode ? cfg.secret_key : (cfg.live_secret_key || cfg.secret_key);
    if (!secretKey) {
      const mode = cfg.test_mode ? 'test' : 'live';
      return jsonResponse({ status: false, error: `Paystack ${mode} secret key not configured` }, 500);
    }

    // Verify with Paystack
    const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(inputRef)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
    });

    if (!verifyResp.ok) {
      const text = await verifyResp.text();
      console.error('Paystack verify error:', verifyResp.status, text);
      return jsonResponse({ status: false, error: `Verification failed: ${text}` }, 400);
    }

    const verifyData = await verifyResp.json();
    if (!verifyData?.status) {
      return jsonResponse({ status: false, error: verifyData?.message || 'Verification failed' }, 400);
    }

    const tx = verifyData.data || {};
    const isSuccess = tx.status === 'success';

    // Attempt to resolve order_id
    let orderId: string | null = body.order_id || null;
    let orderNumber: string | null = body.order_number || null;

    // Try extract from metadata
    try {
      const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata || {});
      orderId ||= meta.order_id || meta.orderId || null;
      orderNumber ||= meta.order_number || meta.orderNumber || null;
    } catch {
      // ignore
    }

    if (!orderId && orderNumber) {
      const { data: byNumber } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .maybeSingle();
      if (byNumber?.id) orderId = byNumber.id;
    }

    // Upsert payment transaction
    const providerRef = inputRef;
    const baseUpdate: any = {
      provider_reference: providerRef,
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

    let upsertError: any = null;
    try {
      const { error } = await supabase
        .from('payment_transactions')
        .upsert(payload, { onConflict: 'provider_reference' });
      upsertError = error;
    } catch (e) {
      upsertError = e;
    }

    if (upsertError) {
      // fallback: update/insert
      const { data: existing } = await supabase
        .from('payment_transactions')
        .select('id')
        .eq('provider_reference', providerRef)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('payment_transactions').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('payment_transactions').insert({ ...payload, created_at: new Date().toISOString() });
      }
    }

    // If we know the order, ensure it carries the canonical reference
    if (orderId) {
      await supabase
        .from('orders')
        .update({ payment_reference: providerRef, updated_at: new Date().toISOString() })
        .eq('id', orderId);
    }

    // If successful, call RPC to finish processing & idempotently confirm order
    if (isSuccess) {
      try {
        const { error: rpcError } = await supabase.rpc('handle_successful_payment', {
          p_reference: providerRef,
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
        if (rpcError) console.warn('handle_successful_payment RPC error:', rpcError);
      } catch (e) {
        console.warn('handle_successful_payment RPC crashed:', e);
      }
    }

    // Return reconciliation result with some context
    let resolvedOrderNumber = orderNumber;
    if (!resolvedOrderNumber && orderId) {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('order_number')
        .eq('id', orderId)
        .maybeSingle();
      resolvedOrderNumber = orderRow?.order_number || null;
    }

    return jsonResponse({
      status: true,
      data: {
        reference: providerRef,
        reconciled: true,
        transaction_status: baseUpdate.status,
        order_id: orderId,
        order_number: resolvedOrderNumber,
      }
    });
  } catch (e: any) {
    console.error('Reconciliation error:', e);
    return jsonResponse({ status: false, error: e?.message || 'Reconciliation failed' }, 500);
  }
});
