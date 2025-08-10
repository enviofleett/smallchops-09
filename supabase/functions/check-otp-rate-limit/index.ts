import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to send OTP email directly using SMTP sender
async function sendOTPEmail(supabase: any, email: string, otp: string, type: 'login' | 'registration' | 'password_reset') {
  try {
    // Determine the correct template key based on the email type
    const templateKey = type === 'password_reset' 
      ? 'password_reset_otp' 
      : type === 'login' 
        ? 'login_otp' 
        : 'customer_registration_otp'; // Fixed template key

    // Directly invoke the SMTP sender function with the corrected payload
    const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        templateId: templateKey,
        recipient: {
          email: email,
          name: 'Valued Customer',
        },
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
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
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

    // Normalize email to lowercase for consistency
    const normalizedEmail = email.toLowerCase();

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get client IP for rate limiting and audit logging
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const clientIP = forwarded 
      ? forwarded.split(',')[0].trim() 
      : realIP || '127.0.0.1';

    // Check rate limit using database function
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc('check_otp_rate_limit', {
      p_email: normalizedEmail
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
      
      // FIXED: Store OTP in customer_otp_codes table (not otp_codes)
      const { error: otpInsertError } = await supabaseAdmin
        .from('customer_otp_codes')  // ✅ Correct table
        .insert({
          email: normalizedEmail,
          otp_code: otpCode,
          otp_type: type,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
          created_by_ip: clientIP,
          verification_metadata: {} // Empty metadata for resends
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
      const emailSent = await sendOTPEmail(supabaseAdmin, normalizedEmail, otpCode, type);
      
      if (!emailSent) {
        // Clean up the OTP record if email fails
        await supabaseAdmin
          .from('customer_otp_codes')
          .delete()
          .eq('email', normalizedEmail)
          .eq('otp_code', otpCode);

        return new Response(
          JSON.stringify({ error: "Failed to send OTP email" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      console.log('OTP generated and sent successfully for:', normalizedEmail);
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