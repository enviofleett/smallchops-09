import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaystackVerifyResp {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    amount: number; // kobo
    currency: string;
    status: "success" | "failed" | "abandoned" | "reversed";
    metadata?: Record<string, unknown>;
  };
}

function mapStatus(s: string): "paid"|"failed"|"abandoned"|"refunded" {
  switch (s) {
    case "success": return "paid";
    case "reversed": return "refunded";
    case "failed": return "failed";
    default: return "abandoned";
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[VERIFY-PAYMENT-UNIFIED] Starting payment verification');
    
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");
    const ref = url.searchParams.get("reference"); // can be txn_* or pay_*
    
    if (!orderId || !ref) {
      console.log('[VERIFY-PAYMENT-UNIFIED] Missing required parameters');
      return new Response(JSON.stringify({ 
        error: "order_id and reference are required" 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[VERIFY-PAYMENT-UNIFIED] Verifying payment - Order: ${orderId}, Reference: ${ref}`);

    // Verify with Paystack
    const psKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!psKey) {
      console.error('[VERIFY-PAYMENT-UNIFIED] PAYSTACK_SECRET_KEY not configured');
      return new Response(JSON.stringify({ 
        error: "Payment provider not configured" 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[VERIFY-PAYMENT-UNIFIED] Calling Paystack API for reference: ${ref}`);
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${psKey}` }
    });

    if (!verifyRes.ok) {
      console.error(`[VERIFY-PAYMENT-UNIFIED] Paystack API error: ${verifyRes.status}`);
      return new Response(JSON.stringify({ 
        error: "Payment provider verification failed",
        status: verifyRes.status 
      }), { 
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const vr: PaystackVerifyResp = await verifyRes.json();
    console.log(`[VERIFY-PAYMENT-UNIFIED] Paystack response:`, JSON.stringify(vr));

    if (!vr?.status || !vr?.data) {
      console.error('[VERIFY-PAYMENT-UNIFIED] Invalid Paystack response');
      return new Response(JSON.stringify({ 
        error: "Unable to verify transaction", 
        detail: vr 
      }), { 
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const providerStatus = mapStatus(vr.data.status);
    const amountNaira = Math.round((vr.data.amount ?? 0) / 100); // convert kobo -> NGN
    
    console.log(`[VERIFY-PAYMENT-UNIFIED] Mapped status: ${providerStatus}, Amount: ${amountNaira} NGN`);

    // Call unified RPC function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[VERIFY-PAYMENT-UNIFIED] Calling unified verification RPC`);
    const { data: rpcData, error: rpcError } = await supabase.rpc('verify_and_update_payment_status', {
      p_order_id: orderId,
      p_reference: ref,                 // may be normalized to txn_* inside RPC
      p_provider_ref: vr.data.reference,
      p_provider: "paystack",
      p_new_state: providerStatus,
      p_amount: amountNaira,
      p_currency: vr.data.currency ?? "NGN",
      p_raw: vr as unknown as Record<string, unknown>
    });

    if (rpcError) {
      console.error('[VERIFY-PAYMENT-UNIFIED] RPC error:', rpcError);
      return new Response(JSON.stringify({ 
        error: "Database verification failed", 
        detail: rpcError.message 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[VERIFY-PAYMENT-UNIFIED] RPC success:`, JSON.stringify(rpcData));

    return new Response(JSON.stringify({ 
      success: true, 
      data: rpcData,
      provider_status: providerStatus,
      amount: amountNaira
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[VERIFY-PAYMENT-UNIFIED] Unexpected error:', e);
    return new Response(JSON.stringify({ 
      error: e?.message ?? "Unknown error" 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});