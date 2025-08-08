import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Compute CORS headers per-request based on origin
function buildCorsHeaders(originHeader: string | null): Record<string, string> {
  const prodOrigins = ['https://startersmallchops.com', 'https://www.startersmallchops.com'];
  const origin = originHeader || '';
  const isLocal =
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.includes('.lovable.app');

  // Echo back the exact allowed origin in production; use * for local and previews
  const allowOrigin = isLocal
    ? '*'
    : (prodOrigins.includes(origin) ? origin : prodOrigins[0]);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
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
    console.log(`Processing ${req.method} request to paystack-verify (build 2025-08-08-5)`);

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

    // Get secrets
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      const res = { error: 'Paystack secret key not configured' };
      return new Response(JSON.stringify(res), { status: 500, headers: corsHeaders });
    }

    // Verify with Paystack
    const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
    const paystackResponse = await fetch(verifyUrl, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await paystackResponse.text();
    let verification: any;
    try {
      verification = text ? JSON.parse(text) : {};
    } catch (_e) {
      verification = { status: false, message: 'Invalid JSON from Paystack', raw: text };
    }

    if (!paystackResponse.ok) {
      // Bubble up Paystack status code with a clean message
      const detail = verification?.message || text || `status ${paystackResponse.status}`;
      const res = { error: `Paystack verification failed: ${detail}` };
      return new Response(JSON.stringify(res), { status: paystackResponse.status, headers: corsHeaders });
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

    // Return exactly { success: true, data } with Paystack JSON data,
    // while keeping top-level order fields for compatibility with existing frontend code.
    const responseBody = {
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
