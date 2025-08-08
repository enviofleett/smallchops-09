import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Compute CORS headers per-request based on origin (use permissive wildcard for reliability across preview/prod)
function buildCorsHeaders(_originHeader: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  // Preflight handling
  if (req.method === 'OPTIONS') {
    // Always OK for preflight
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    console.log(`Processing ${req.method} request to paystack-verify (build 2025-08-08-6)`);

    // Healthcheck endpoint: GET ?health=1 returns presence of required secrets
    let reference = '';
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const health = url.searchParams.get('health');
      if (health === '1' || health === 'true') {
        const healthBody = {
          ok: true,
          hasPaystackKey: Boolean(Deno.env.get('PAYSTACK_SECRET_KEY')),
          hasServiceRole: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
          hasSupabaseUrl: Boolean(Deno.env.get('SUPABASE_URL')),
          version: '2025-08-08-6',
          timestamp: new Date().toISOString(),
        };
        return new Response(JSON.stringify(healthBody), { status: 200, headers: corsHeaders });
      }
      reference = url.searchParams.get('reference') ?? '';
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      reference = body?.reference || '';
    }

    if (!reference) {
      const res = { error: 'Transaction reference is required' };
      return new Response(JSON.stringify(res), { status: 400, headers: corsHeaders });
    }

    // Resolve Paystack secret key: ENV first, fallback to DB config
    let paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
    if (!paystackSecretKey) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { auth: { persistSession: false } }
        );
        const { data: cfg, error: cfgErr } = await supabaseClient
          .from('payment_integrations')
          .select('test_mode, secret_key, live_secret_key')
          .eq('provider', 'paystack')
          .eq('connection_status', 'connected')
          .single();
        if (!cfgErr && cfg) {
          paystackSecretKey = cfg.test_mode ? cfg.secret_key : (cfg.live_secret_key || cfg.secret_key);
        }
      } catch (_e) {}
    }
    if (!paystackSecretKey) {
      const res = { error: 'Paystack secret key not configured' };
      return new Response(JSON.stringify(res), { status: 500, headers: corsHeaders });
    }

    // Verify with Paystack (retry up to 3 times)
    const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
    let verification: any = null;
    let lastStatus = 0;
    let lastText = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(verifyUrl, {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      });
      lastStatus = res.status;
      lastText = await res.text();
      try {
        verification = lastText ? JSON.parse(lastText) : {};
      } catch (_e) {
        verification = { status: false, message: 'Invalid JSON from Paystack', raw: lastText };
      }
      if (res.ok) break;
      const shouldRetry = res.status >= 500 || res.status === 429;
      if (!shouldRetry && attempt === 1) break;
      await new Promise((r) => setTimeout(r, attempt * 400));
    }

    if (!verification || (lastStatus && lastStatus >= 400 && verification?.status !== true)) {
      // Bubble up Paystack status code with a clean message
      const detail = verification?.message || lastText || `status ${lastStatus}`;
      const res = { error: `Paystack verification failed: ${detail}` };
      return new Response(JSON.stringify(res), { status: lastStatus || 502, headers: corsHeaders });
    }

    // Determine success flag based on Paystack response
    const ps = verification?.data;
    const isSuccess = verification?.status === true && ps?.status === 'success';

    // Optionally update order in DB (kept for backward compatibility with existing app flows)
    let orderInfo: { order_id: string | null; order_number: string | null; customer_name?: string | null } = {
      order_id: null,
      order_number: null,
    };

    try {
      if (isSuccess) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { auth: { persistSession: false } }
        );

        // Prefer order_id from Paystack metadata returned by verification
        const metadata = ps?.metadata || ps?.meta || {};
        let targetOrderId: string | null = metadata?.order_id || metadata?.orderId || metadata?.order?.id || null;

        // Fallback 1: find order by stored reference or by assuming the reference is the order id
        if (!targetOrderId) {
          const { data: foundOrder, error: findOrderError } = await supabaseClient
            .from('orders')
            .select('id, order_number, customer_name, customer_email')
            .or(`payment_reference.eq.${reference},id.eq.${reference}`)
            .maybeSingle();

          if (!findOrderError && foundOrder) {
            targetOrderId = foundOrder.id;
            orderInfo = {
              order_id: foundOrder.id,
              order_number: foundOrder.order_number,
              customer_name: foundOrder.customer_name
            };
          }
        }

        // Fallback 2: look up a payment transaction row to resolve the order id
        if (!targetOrderId) {
          const { data: txnRow } = await supabaseClient
            .from('payment_transactions')
            .select('order_id')
            .eq('provider_reference', reference)
            .maybeSingle();
          if (txnRow?.order_id) {
            targetOrderId = txnRow.order_id as string;
          }
        }

        // Record successful payment via RPC (updates transactions and also confirms order)
        try {
          const paidAt = ps?.paid_at || ps?.transaction_date || ps?.paidAt || new Date().toISOString();
          const auth = ps?.authorization || {};
          await supabaseClient.rpc('handle_successful_payment', {
            p_reference: reference,
            p_paid_at: new Date(paidAt).toISOString(),
            p_gateway_response: ps?.gateway_response || verification?.message || 'Payment verified successfully',
            p_fees: Number(ps?.fees ?? ps?.fees_charged ?? 0),
            p_channel: ps?.channel || 'online',
            p_authorization_code: auth?.authorization_code ?? null,
            p_card_type: auth?.card_type ?? null,
            p_last4: auth?.last4 ?? null,
            p_exp_month: (auth?.exp_month ?? null) as any,
            p_exp_year: (auth?.exp_year ?? null) as any,
            p_bank: auth?.bank ?? null,
          });
        } catch (rpcErr) {
          console.warn('RPC handle_successful_payment failed (non-fatal):', rpcErr);
        }

        // Ensure orders table reflects paid/confirmed even if RPC path above didnt resolve it
        if (targetOrderId) {
          await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .eq('id', targetOrderId);

          // Fetch basic order info for response consistency
          const { data: ord } = await supabaseClient
            .from('orders')
            .select('id, order_number, customer_name')
            .eq('id', targetOrderId)
            .maybeSingle();

          orderInfo = {
            order_id: ord?.id || targetOrderId,
            order_number: ord?.order_number || null,
            customer_name: ord?.customer_name || null,
          };
          console.log('Order updated/confirmed successfully:', orderInfo);
        } else {
          console.warn('Could not resolve order id for reference:', reference);
        }
      }
    } catch (orderErr) {
      console.warn('Order update step skipped due to error:', orderErr);
      // Do not fail the verification result if order update failed
    }

    // Return a Paystack-compatible structure for the app
    const responseBody = {
      status: isSuccess,
      success: isSuccess,
      data: ps ?? verification, // prefer Paystack "data" object; fallback to entire response
      order_id: orderInfo.order_id,
      order_number: orderInfo.order_number,
      message: isSuccess ? 'Payment verified successfully' : (verification?.message || 'Verification completed'),
    };

    return new Response(JSON.stringify(responseBody), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('paystack-verify error:', error);
    const res = { error: error?.message || 'Payment verification failed' };
    return new Response(JSON.stringify(res), { status: 500, headers: buildCorsHeaders(req.headers.get('origin')) });
  }
});
