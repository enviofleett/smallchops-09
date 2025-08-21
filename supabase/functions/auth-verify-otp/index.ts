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

// Interface for OTP verification request matching existing API format
interface AuthVerifyOTPRequest {
  email: string;
  token: string;
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
    const { email, token }: AuthVerifyOTPRequest = await req.json();

    // Input validation
    if (!email || !token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email and verification token are required"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate token format (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(token)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid verification code format"
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

    // Get client IP for logging
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Call existing OTP verification function
    const { data: verificationResult, error: verificationError } = await supabase.functions.invoke(
      'customer-otp-verification',
      {
        body: {
          email: email.toLowerCase(),
          otpCode: token,
          otpType: 'registration'
        }
      }
    );

    if (verificationError || !verificationResult?.success) {
      const errorMessage = verificationResult?.error || verificationError?.message || "OTP verification failed";
      
      // Log failed verification
      await supabase.rpc('log_registration_security_event', {
        p_event_type: 'otp_verification_failed',
        p_email: email.toLowerCase(),
        p_ip_address: clientIP !== 'unknown' ? clientIP : null,
        p_user_agent: req.headers.get('user-agent') || 'unknown',
        p_success: false,
        p_metadata: { 
          error: errorMessage,
          otp_provided: token.substring(0, 2) + '****' // Log partial for debugging
        }
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

    // Check if user was successfully created and verified
    if (!verificationResult.auth_user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Account verification failed. Please try again."
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log successful verification
    await supabase.rpc('log_registration_security_event', {
      p_event_type: 'registration_completed',
      p_email: email.toLowerCase(),
      p_ip_address: clientIP !== 'unknown' ? clientIP : null,
      p_user_agent: req.headers.get('user-agent') || 'unknown',
      p_success: true,
      p_metadata: { 
        auth_user_id: verificationResult.auth_user_id,
        customer_id: verificationResult.customer_id,
        welcome_email_sent: verificationResult.welcome_email_sent || false,
        correlation_id: verificationResult.correlation_id
      }
    });

    // Trigger welcome email if not already sent
    if (!verificationResult.welcome_email_sent) {
      try {
        // Get customer data for welcome email
        const { data: customerData } = await supabase
          .from('customer_accounts')
          .select('name, email')
          .eq('id', verificationResult.customer_id)
          .single();

        if (customerData) {
          // Queue welcome email
          await supabase.functions.invoke('customer-welcome-processor', {
            body: {
              customer_email: customerData.email,
              customer_name: customerData.name,
              trigger_type: 'registration'
            }
          });
        }
      } catch (welcomeError) {
        console.error('Welcome email trigger error:', welcomeError);
        // Don't fail the registration if welcome email fails
      }
    }

    // Return success response in expected format
    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration completed successfully",
        auth_user_id: verificationResult.auth_user_id,
        customer_id: verificationResult.customer_id,
        email_verified: true,
        welcome_email_sent: true,
        correlation_id: verificationResult.correlation_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Auth verify OTP error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Verification service error. Please try again."
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});