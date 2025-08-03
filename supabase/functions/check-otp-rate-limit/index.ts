import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check rate limit using database function
    const { data, error } = await supabaseAdmin.rpc('check_otp_rate_limit', {
      p_email: email
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return new Response(
        JSON.stringify({ error: "Rate limit check failed" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // If rate limit check passes, queue OTP email
    if (data?.allowed) {
      // Generate OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Queue OTP email with proper format
      const { error: emailError } = await supabaseAdmin
        .from('communication_events')
        .insert({
          event_type: 'login_otp',
          recipient_email: email,
          status: 'queued',
          template_key: 'login_otp',
          template_variables: {
            otpCode: otpCode,
            email: email
          },
          priority: 'high'
        });

      if (emailError) {
        console.error('Error queuing OTP email:', emailError);
      } else {
        console.log('OTP email queued successfully for:', email);
        
        // Trigger immediate processing
        try {
          await supabaseAdmin.functions.invoke('instant-email-processor');
        } catch (processingError) {
          console.error('Error triggering email processing:', processingError);
        }
      }
    }

    if (error) {
      console.error('Rate limit check error:', error);
      return new Response(
        JSON.stringify({ error: "Rate limit check failed" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});