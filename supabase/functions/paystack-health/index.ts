
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    console.log(`paystack-health ${req.method} (build centralized-config)`);

    // Check ENV secrets
    const envSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const envWebhookSecret = Deno.env.get("PAYSTACK_WEBHOOK_SECRET");

    // Check DB config via RPC (ENV first, but we want to report accurately)
    let dbConfig: any = null;
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      const { data: cfg } = await supabaseAdmin.rpc('get_active_paystack_config');
      dbConfig = Array.isArray(cfg) ? cfg?.[0] : cfg;
    } catch (e) {
      console.warn('Health RPC get_active_paystack_config failed:', e);
    }

    // Always return health info for GET/POST
    const body = {
      ok: true,
      hasPaystackKey: Boolean(envSecret || dbConfig?.secret_key),
      hasWebhookSecret: Boolean(envWebhookSecret || dbConfig?.webhook_secret || envSecret),
      hasServiceRole: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      environment: dbConfig?.environment || (envSecret ? 'env' : 'unknown'),
      test_mode: typeof dbConfig?.test_mode === 'boolean' ? dbConfig.test_mode : undefined,
      timestamp: new Date().toISOString(),
      source: {
        envSecret: Boolean(envSecret),
        envWebhookSecret: Boolean(envWebhookSecret),
        rpc: Boolean(dbConfig),
      }
    };

    return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("paystack-health error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || "unknown" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
