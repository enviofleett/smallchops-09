
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Always respond to OPTIONS with proper CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Defensive parse & validation
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Malformed JSON body", details: e?.message || String(e) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sms_api_key, sms_sender_id } = body || {};
    if (!sms_api_key || !sms_sender_id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters (API key or Sender ID)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize sender_id and key length (basic)
    if (typeof sms_api_key !== "string" || sms_api_key.length < 6) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (
      typeof sms_sender_id !== "string" ||
      sms_sender_id.length < 3 ||
      sms_sender_id.length > 11 ||
      !/^[a-zA-Z0-9]+$/.test(sms_sender_id)
    ) {
      return new Response(
        JSON.stringify({ error: "Sender ID must be 3-11 alphanumeric characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      api_key: sms_api_key,
      sender_id: sms_sender_id,
      phone: "2348012345678", // Dedicated test number; change if MySmstab provides test support
      message: "MySmstab SMS connection test: If you received this, your credentials are valid.",
    };

    // Add timeout protection for fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    let resp, result;
    try {
      resp = await fetch("https://mysmstab.com/api/sms/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      result = await resp.json();
    } catch (e) {
      clearTimeout(timeout);
      return new Response(
        JSON.stringify({ error: "Network error contacting MySmstab", details: e?.message || String(e) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeout);

    if ((result.status && result.status === "success") || (result.error === false)) {
      return new Response(
        JSON.stringify({ data: { success: true, response: result } }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Failed to send test SMS (MySmstab)", details: result.message || "No details" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Error processing test SMS request", details: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
