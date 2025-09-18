import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DEPRECATED: We now prefer Supabase Auth for user management
// This function is maintained for backward compatibility but should be migrated
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, password, name, phone, otpCode } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get client IP and user agent for security logging
    const clientIP = req.headers.get("x-forwarded-for") || 
                    req.headers.get("x-real-ip") || 
                    "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    switch (action) {
      case "register": {
        // SECURITY WARNING: This custom registration is deprecated
        // New implementations should use Supabase Auth directly
        
        console.warn("⚠️ DEPRECATED: Custom password auth is deprecated. Use Supabase Auth instead.");
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Custom password registration is deprecated. Please use Supabase Auth.",
            migration_required: true,
            recommended_action: "Use supabase.auth.signUp() instead"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify_otp": {
        if (!email || !otpCode) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Email and OTP code are required" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify OTP using secure function
        const { data: verificationResult, error: verificationError } = await supabaseAdmin.rpc(
          'verify_customer_otp',
          {
            p_email: email,
            p_otp_code: otpCode,
            p_otp_type: 'registration',
            p_ip_address: clientIP
          }
        );

        if (verificationError || !verificationResult?.success) {
          // Log failed verification attempt
          await supabaseAdmin.rpc('log_security_event', {
            p_event_type: 'otp_verification_failed',
            p_severity: 'medium',
            p_description: 'Failed OTP verification attempt',
            p_metadata: { 
              email, 
              otp_code: otpCode,
              error: verificationError?.message || verificationResult?.error,
              ip_address: clientIP 
            }
          });

          return new Response(
            JSON.stringify({ 
              success: false, 
              error: verificationResult?.error || "OTP verification failed" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log successful verification
        await supabaseAdmin.rpc('log_security_event', {
          p_event_type: 'otp_verification_success',
          p_severity: 'low',
          p_description: 'Customer successfully verified OTP',
          p_metadata: { 
            email, 
            customer_id: verificationResult.customer_id,
            ip_address: clientIP 
          }
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            customer_id: verificationResult.customer_id,
            email_verified: verificationResult.email_verified,
            message: "OTP verification successful" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_rate_limit": {
        if (!email) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Email is required" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check rate limit using secure function
        const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin.rpc(
          'check_otp_rate_limit_secure',
          { p_email: email }
        );

        if (rateLimitError) {
          console.error('Rate limit check failed:', rateLimitError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Rate limit check failed" 
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify(rateLimitResult),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid action" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error) {
    console.error('Secure customer auth error:', error);
    
    // Log security incident
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    await supabaseAdmin.rpc('log_security_event', {
      p_event_type: 'customer_auth_error',
      p_severity: 'high',
      p_description: 'Unexpected error in customer authentication',
      p_metadata: { 
        error: error.message,
        stack: error.stack,
        ip_address: req.headers.get("x-forwarded-for") || "unknown"
      }
    });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
})

/*
🔐 SECURE CUSTOMER AUTH v2.0 - DEPRECATED

⚠️ SECURITY NOTICE:
- Custom password hashing has been deprecated
- SHA-256 with static salt is cryptographically weak
- This function now redirects to Supabase Auth for new registrations
- Existing OTP and rate limiting functions are maintained

🔧 MIGRATION GUIDE:
Instead of custom registration, use:
```javascript
// NEW: Use Supabase Auth
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password',
  options: {
    data: {
      name: 'User Name',
      phone: '+1234567890'
    }
  }
})
```

🔒 SECURITY IMPROVEMENTS IMPLEMENTED:
- ✅ Deprecated weak password hashing
- ✅ Redirects to secure Supabase Auth
- ✅ Maintains OTP verification compatibility
- ✅ Enhanced security logging
- ✅ Comprehensive error handling
*/