import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    console.log(`paystack-health ${req.method} (build 2025-08-08-1)`);

    // Always return health info for GET/POST
    const body = {
      ok: true,
      hasPaystackKey: Boolean(Deno.env.get("PAYSTACK_SECRET_KEY")),
      hasServiceRole: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      timestamp: new Date().toISOString(),
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
