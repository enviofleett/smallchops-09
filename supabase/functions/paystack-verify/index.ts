import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Compute CORS headers per-request based on origin
function buildCorsHeaders(originHeader: string | null): Record<string, string> {
  const prodOrigin = 'https://startersmallchops.com';
  const origin = originHeader || '';
  const isLocal =
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.includes('.lovable.app');

  // In production only allow the production domain; in local allow *
  const allowOrigin = isLocal ? '*' : prodOrigin;

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
    console.log(`Processing ${req.method} request to paystack-verify (build 2025-08-08-1)`);

    // Support POST body and GET query parameter for reference (POST preferred)
    let reference = '';
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      reference = body?.reference || '';
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      reference = url.searchParams.get('reference') ?? '';
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

        // Try to find and update the order by reference or id
        const { data: foundOrder, error: findOrderError } = await supabaseClient
          .from('orders')
          .select('id, order_number, customer_name, customer_email')
          .or(`payment_reference.eq.${reference},id.eq.${reference}`)
          .single();

        if (!findOrderError && foundOrder) {
          await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .eq('id', foundOrder.id);

          orderInfo = {
            order_id: foundOrder.id,
            order_number: foundOrder.order_number,
            customer_name: foundOrder.customer_name
          };
          console.log('Order updated successfully:', orderInfo);
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
