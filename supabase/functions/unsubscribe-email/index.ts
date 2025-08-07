import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type UnsubRequest = { email?: string; reason?: string };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Support GET (?email=) and POST ({ email })
    let email = new URL(req.url).searchParams.get("email") || undefined;
    if (!email && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as UnsubRequest;
      email = body.email;
    }

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize
    email = email.trim().toLowerCase();

    // Insert into suppression list (idempotent)
    const { error } = await supabase.from("email_suppression_list").upsert(
      {
        email_address: email,
        suppressed_at: new Date().toISOString(),
        suppression_reason: "user_unsubscribed",
      },
      { onConflict: "email_address" }
    );

    if (error) {
      console.error("Unsubscribe insert error:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, email, message: "You have been unsubscribed." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("unsubscribe-email error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
