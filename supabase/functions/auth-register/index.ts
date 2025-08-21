import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Enhanced CORS headers with origin validation
const getAllowedOrigins = () => {
  const envType = Deno.env.get('DENO_ENV') || 'development';
  if (envType === 'production') {
    return ['https://oknnklksdiqaifhxaccs.supabase.co', 'https://lovable.dev']; // Add your production domains
  }
  return ['*']; // Allow all in development
};

const getCorsHeaders = (origin?: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin)) ? (origin || '*') : 'null';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Interface for the registration request matching existing API format
interface AuthRegisterRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enhanced security: Validate origin in production
  const envType = Deno.env.get('DENO_ENV') || 'development';
  if (envType === 'production' && origin) {
    const allowedOrigins = getAllowedOrigins();
    if (!allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
      return new Response(
        JSON.stringify({ success: false, error: "Origin not allowed" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    // Parse and validate request
    const { fullName, email, phoneNumber }: AuthRegisterRequest = await req.json();

    // Input validation
    if (!fullName || !email || !phoneNumber) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Full name, email, and phone number are required"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid email format"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limiting
    const { data: rateLimitCheck, error: rateLimitError } = await supabase
      .rpc('check_registration_rate_limit_secure', {
        p_email: email.toLowerCase(),
        p_ip_address: clientIP !== 'unknown' ? clientIP : null
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Registration service temporarily unavailable"
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!rateLimitCheck?.allowed) {
      const reason = rateLimitCheck?.reason || 'rate_limited';
      const retryAfter = rateLimitCheck?.retry_after_seconds || 3600;
      
      // Log security event
      await supabase.rpc('log_registration_security_event', {
        p_event_type: 'registration_rate_limited',
        p_email: email.toLowerCase(),
        p_ip_address: clientIP !== 'unknown' ? clientIP : null,
        p_user_agent: req.headers.get('user-agent') || 'unknown',
        p_success: false,
        p_metadata: { reason, retry_after_seconds: retryAfter }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: reason === 'cooldown_active' 
            ? "Please wait a moment before trying again"
            : "Too many registration attempts. Please try again later",
          retry_after_seconds: retryAfter
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate phone number format
    const { data: phoneValid, error: phoneError } = await supabase
      .rpc('validate_phone_number', { phone_text: phoneNumber });

    if (phoneError || !phoneValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please provide a valid phone number with country code (e.g., +1234567890)"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Call existing secure customer registration function
    const { data: registrationResult, error: registrationError } = await supabase.functions.invoke(
      'customer-auth-register',
      {
        body: {
          email: email.toLowerCase(),
          password: generateSecurePassword(), // Generate temporary secure password
          name: fullName,
          phone: phoneNumber
        }
      }
    );

    if (registrationError || !registrationResult?.success) {
      const errorMessage = registrationResult?.error || registrationError?.message || "Registration failed";
      
      // Log failure
      await supabase.rpc('log_registration_security_event', {
        p_event_type: 'registration_failed',
        p_email: email.toLowerCase(),
        p_ip_address: clientIP !== 'unknown' ? clientIP : null,
        p_user_agent: req.headers.get('user-agent') || 'unknown',
        p_success: false,
        p_metadata: { error: errorMessage, has_phone: true }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log successful registration initiation
    await supabase.rpc('log_registration_security_event', {
      p_event_type: 'registration_initiated',
      p_email: email.toLowerCase(),
      p_ip_address: clientIP !== 'unknown' ? clientIP : null,
      p_user_agent: req.headers.get('user-agent') || 'unknown',
      p_success: true,
      p_metadata: { 
        has_phone: true, 
        correlation_id: registrationResult.correlation_id,
        otp_sent: true
      }
    });

    // Return success response in expected format
    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent to your email",
        requiresOtpVerification: true,
        email: email.toLowerCase(),
        correlation_id: registrationResult.correlation_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Auth register error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Registration service error. Please try again."
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Generate a secure temporary password for Supabase Auth
function generateSecurePassword(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}