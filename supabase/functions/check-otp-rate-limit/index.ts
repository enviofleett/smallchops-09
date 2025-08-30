import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to send OTP email directly using SMTP sender
async function sendOTPEmail(supabase: any, email: string, otp: string, type: 'login' | 'registration' | 'password_reset') {
  try {
    // Determine the correct template key based on the email type
    const templateKey = type === 'password_reset' ? 'password_reset_otp' : type === 'login' ? 'login_otp' : 'registration_otp';

    // Directly invoke the unified SMTP sender function with the corrected payload
    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: {
        to: email,
        templateKey: templateKey,
        variables: {
          otpCode: otp,
          customerEmail: email,
          companyName: 'Starters',
          expiryMinutes: '10'
        },
        emailType: 'transactional',
      }
    });

    if (error) {
      console.error('OTP email send error:', error);
      return false;
    }

    console.log('OTP email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type = 'login' } = await req.json();

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

    // Check rate limit using secure database function
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc('check_otp_rate_limit_secure', {
      p_email: email
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: "Rate limit check failed" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // If rate limit check passes, generate and send OTP immediately
    if (rateLimitData?.allowed) {
      // Generate OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database for verification
      const { error: otpInsertError } = await supabaseAdmin
        .from('otp_codes')
        .insert({
          email: email,
          otp_code: otpCode,
          otp_type: type,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
        });

      if (otpInsertError) {
        console.error('Error storing OTP:', otpInsertError);
        return new Response(
          JSON.stringify({ error: "Failed to generate OTP" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Send OTP email immediately
      const emailSent = await sendOTPEmail(supabaseAdmin, email, otpCode, type);
      
      if (!emailSent) {
        console.error('Failed to send OTP email');
        return new Response(
          JSON.stringify({ error: "Failed to send OTP email" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      console.log('OTP generated and sent successfully for:', email);
    }

    return new Response(
      JSON.stringify({
        allowed: rateLimitData?.allowed || false,
        remaining: rateLimitData?.remaining || 0,
        resetTime: rateLimitData?.resetTime,
        message: rateLimitData?.allowed ? 'OTP sent successfully' : 'Rate limit exceeded'
      }),
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