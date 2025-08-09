import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment configuration" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Auth-bound client (end-user JWT) for authorization checks
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
      auth: { persistSession: false },
    });

    // Admin client (service role) for privileged reads/updates
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Only admins can run this function
    const { data: isAdmin, error: adminErr } = await supabaseUser.rpc("is_admin");
    if (adminErr || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin access required" }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Parse payload
    const payload = (req.method === "POST" ? await req.json().catch(() => ({})) : {}) as {
      excludeOrderNumbers?: string[];
      limit?: number;
      dryRun?: boolean;
    };

    const exclude = payload.excludeOrderNumbers && Array.isArray(payload.excludeOrderNumbers)
      ? payload.excludeOrderNumbers
      : ["ORD-20250808-6181"]; // default exclusion per request

    const limit = Math.max(1, Math.min(Number(payload.limit) || 200, 1000));
    const dryRun = Boolean(payload.dryRun);

    // Fetch candidate orders (not paid, with a payment_reference)
    const { data: orders, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, payment_reference, payment_status, total_amount")
      .not("payment_reference", "is", null)
      .neq("payment_status", "paid")
      .order("order_time", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch orders: ${fetchErr.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    const candidates = (orders || []).filter((o) => !!o.payment_reference && !exclude.includes(o.order_number));

    if (dryRun) {
      return new Response(
        JSON.stringify({ ok: true, dryRun: true, candidates: candidates.map((c) => ({ id: c.id, order_number: c.order_number, payment_reference: c.payment_reference })) }),
        { status: 200, headers: corsHeaders }
      );
    }

    const results: Array<{
      order_id: string;
      order_number: string;
      reference: string;
      status: "verified" | "pending" | "failed" | "error";
      message?: string;
    }> = [];

    // Process sequentially with small delay to avoid rate limiting
    for (const o of candidates) {
      const reference = o.payment_reference as string;
      try {
        const verifyRes = await supabaseAdmin.functions.invoke("paystack-verify", {
          body: { reference },
        });

        if (verifyRes.error) {
          results.push({ order_id: o.id, order_number: o.order_number, reference, status: "error", message: verifyRes.error.message });
        } else {
          const data: any = verifyRes.data;
          if (data?.success === true) {
            results.push({ order_id: o.id, order_number: o.order_number, reference, status: "verified" });
          } else if (data?.status === "pending") {
            results.push({ order_id: o.id, order_number: o.order_number, reference, status: "pending", message: data?.message });
          } else {
            results.push({ order_id: o.id, order_number: o.order_number, reference, status: "failed", message: data?.error || data?.message });
          }
        }
      } catch (e: any) {
        results.push({ order_id: o.id, order_number: o.order_number, reference, status: "error", message: e?.message || "invoke failed" });
      }

      // Small delay between calls (100ms)
      await new Promise((r) => setTimeout(r, 100));
    }

    const summary = {
      totalCandidates: candidates.length,
      verified: results.filter((r) => r.status === "verified").length,
      pending: results.filter((r) => r.status === "pending").length,
      failed: results.filter((r) => r.status === "failed").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    // Optional: audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "paystack_batch_verify",
      category: "Payment Processing",
      message: `Batch verify run: ${summary.verified} verified / ${summary.pending} pending / ${summary.failed} failed / ${summary.errors} errors` ,
      new_values: { exclude, limit, summary },
    });

    return new Response(
      JSON.stringify({ ok: true, summary, results }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("paystack-batch-verify error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unexpected error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});