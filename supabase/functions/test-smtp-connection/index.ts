import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/smtp/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, sender_email } = await req.json();

    // Defensive validation
    if (!smtp_host || !smtp_port || !smtp_user || !smtp_pass || !sender_email) {
      return new Response(
        JSON.stringify({ error: "Missing required SMTP parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtp_host,
        port: Number(smtp_port),
        tls: true,
        auth: {
          username: smtp_user,
          password: smtp_pass,
        },
      },
    });

    // Timeout provision for test email (e.g., 10s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      await client.send({
        from: sender_email,
        to: sender_email,
        subject: "SMTP Connection Test Successful",
        content: "This is a test email to confirm your SMTP settings are correct.",
        html: "<p>This is a test email to confirm your SMTP settings are correct.</p>",
      });
    } catch (e) {
      clearTimeout(timeout);
      return new Response(
        JSON.stringify({ error: "SMTP Connection Failed", details: e?.message || String(e) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeout);

    await client.close();

    return new Response(
      JSON.stringify({ data: { message: "Connection successful and test email sent." } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "SMTP Test Error", details: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
