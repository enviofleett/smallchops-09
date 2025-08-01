import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOTPRequest {
  email: string;
  purpose: 'login' | 'registration' | 'password_reset';
  customerName?: string;
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

    const { email, purpose, customerName }: GenerateOTPRequest = await req.json();

    console.log(`Generating OTP for ${email} with purpose: ${purpose}`);

    // Validate input
    if (!email || !purpose) {
      return new Response(
        JSON.stringify({ error: 'Email and purpose are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: rateLimitCheck } = await supabase.rpc('check_otp_rate_limit', {
      p_email: email,
      p_purpose: purpose
    });

    if (!rateLimitCheck) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many OTP requests. Please wait before requesting another code.',
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Get client IP and User-Agent for security logging
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const userAgent = req.headers.get('user-agent');

    // Store OTP in database
    const { data: otpRecord, error: otpError } = await supabase
      .from('email_otp_verification')
      .insert({
        email,
        code: otpCode,
        purpose,
        expires_at: expiresAt.toISOString(),
        ip_address: clientIP,
        user_agent: userAgent
      })
      .select()
      .single();

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get business settings for email template
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('name')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const companyName = businessSettings?.name || 'Starters';

    // Determine template key based on purpose
    const templateKey = `${purpose}_otp`;
    
    // Send OTP email using existing SMTP infrastructure
    const { error: emailError } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        template_id: templateKey,
        recipient_email: email,
        variables: {
          customerName: customerName || 'Customer',
          otpCode: otpCode,
          companyName: companyName
        }
      }
    });

    if (emailError) {
      console.error('Error sending OTP email:', emailError);
      
      // Clean up the OTP record if email failed
      await supabase
        .from('email_otp_verification')
        .delete()
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: 'Failed to send OTP email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`OTP sent successfully to ${email}`);

    // Clean up expired OTPs
    await supabase.rpc('cleanup_expired_otps');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        expiresIn: 300 // 5 minutes in seconds
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('Error in generate-otp-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});