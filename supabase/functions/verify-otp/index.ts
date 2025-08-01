import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyOTPRequest {
  email: string;
  code: string;
  purpose: 'login' | 'registration' | 'password_reset';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, code, purpose }: VerifyOTPRequest = await req.json();

    console.log(`Verifying OTP for ${email} with purpose: ${purpose}`);

    // Validate input
    if (!email || !code || !purpose) {
      return new Response(
        JSON.stringify({ error: 'Email, code, and purpose are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP format. Please enter a 6-digit code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('email_otp_verification')
      .select('*')
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      console.log('No valid OTP found for email:', email);
      return new Response(
        JSON.stringify({ 
          error: 'No valid OTP found. Please request a new code.',
          notFound: true 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP has expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    
    if (now > expiresAt) {
      console.log('OTP expired for email:', email);
      
      // Mark as expired (optional, for analytics)
      await supabase
        .from('email_otp_verification')
        .update({ verified: false })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ 
          error: 'OTP has expired. Please request a new code.',
          expired: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if too many attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('Too many attempts for OTP:', otpRecord.id);
      return new Response(
        JSON.stringify({ 
          error: 'Too many incorrect attempts. Please request a new code.',
          maxAttemptsReached: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the code
    if (otpRecord.code !== code) {
      console.log('Invalid OTP code provided');
      
      // Increment attempts
      const newAttempts = otpRecord.attempts + 1;
      await supabase
        .from('email_otp_verification')
        .update({ attempts: newAttempts })
        .eq('id', otpRecord.id);

      const remainingAttempts = otpRecord.max_attempts - newAttempts;
      
      return new Response(
        JSON.stringify({ 
          error: `Invalid OTP code. ${remainingAttempts} attempts remaining.`,
          invalidCode: true,
          remainingAttempts
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OTP is valid! Mark as verified
    const { error: updateError } = await supabase
      .from('email_otp_verification')
      .update({ 
        verified: true, 
        verified_at: new Date().toISOString() 
      })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('Error updating OTP record:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate or handle authentication based on purpose
    let authResult = {};

    if (purpose === 'login') {
      // For login, we can optionally return a session token
      // This would require additional logic to create a user session
      authResult = {
        loginVerified: true,
        email: email
      };
    } else if (purpose === 'registration') {
      // For registration, mark email as verified
      authResult = {
        emailVerified: true,
        email: email
      };
    } else if (purpose === 'password_reset') {
      // For password reset, allow password change
      authResult = {
        resetVerified: true,
        email: email
      };
    }

    console.log(`OTP verified successfully for ${email}`);

    // Clean up expired OTPs
    await supabase.rpc('cleanup_expired_otps');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP verified successfully',
        ...authResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('Error in verify-otp function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});