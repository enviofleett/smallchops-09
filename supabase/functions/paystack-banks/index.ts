import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

// Lightweight in-memory cache for banks to avoid rate limits / bottlenecks
let banksCache: { data: any[]; expiresAt: number } | null = null;
const BANKS_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper: resolve effective Paystack secret key from ENV first, fallback to DB RPC
async function getPaystackSecret(): Promise<string> {
  // ENV override first for operational convenience
  const envSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (envSecret) return envSecret;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: cfg, error } = await supabase.rpc("get_active_paystack_config");
    if (error) {
      console.warn("RPC get_active_paystack_config error:", error.message);
      return "";
    }
    const effective = Array.isArray(cfg) ? cfg?.[0] : cfg;
    return (effective?.secret_key as string) || "";
  } catch (e) {
    console.warn("RPC get_active_paystack_config call failed:", e);
    return "";
  }
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ status: false, error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Serve from cache if fresh
    const now = Date.now();
    if (banksCache && now < banksCache.expiresAt) {
      return new Response(
        JSON.stringify({ status: true, data: banksCache.data, count: banksCache.data.length }),
        { status: 200, headers: corsHeaders }
      );
    }

    const secret = await getPaystackSecret();
    if (!secret) {
      return new Response(
        JSON.stringify({ status: false, error: "Paystack secret key not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Fetch Nigerian banks from Paystack
    const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ status: false, error: `Paystack API error: ${res.status} ${res.statusText}` }),
        { status: res.status, headers: corsHeaders }
      );
    }

    const parsed: any = text ? JSON.parse(text) : { status: false, data: [] };
    if (!parsed?.status) {
      return new Response(
        JSON.stringify({ status: false, error: parsed?.message || "Failed to fetch banks" }),
        { status: 502, headers: corsHeaders }
      );
    }

    const banks = (parsed.data || []).map((bank: any) => ({
      name: bank.name,
      code: bank.code,
      active: bank.active,
      is_deleted: bank.is_deleted,
      country: bank.country,
      currency: bank.currency,
      type: bank.type,
      slug: bank.slug,
    }));

    // Cache the result
    banksCache = { data: banks, expiresAt: now + BANKS_TTL_MS };

    return new Response(JSON.stringify({ status: true, data: banks, count: banks.length }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("Banks fetch error:", error);
    return new Response(
      JSON.stringify({ status: false, error: error?.message || "Failed to fetch banks" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
