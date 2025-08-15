import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHash } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secure password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "starters_salt_2024"); // Add salt
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Enhanced password validation
function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  if (!/[A-Za-z]/.test(password)) {
    errors.push("Password must contain at least one letter");
  }
  
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  const commonPasswords = ['password', '12345678', 'password123', 'admin123', 'qwerty'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too common and easily guessable");
  }
  
  return { valid: errors.length === 0, errors };
}

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
        // Validate required fields
        if (!email || !password || !name) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Email, password, and name are required" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          await supabaseAdmin.rpc('log_security_event', {
            p_event_type: 'weak_password_attempt',
            p_severity: 'low',
            p_description: 'User attempted registration with weak password',
            p_metadata: { 
              email, 
              errors: passwordValidation.errors,
              ip_address: clientIP 
            }
          });

          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Password requirements not met",
              details: passwordValidation.errors
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Hash the password securely
        const hashedPassword = await hashPassword(password);

        // Create customer account using secure function
        const { data: customerResult, error: customerError } = await supabaseAdmin.rpc(
          'create_customer_account_secure',
          {
            p_email: email,
            p_name: name,
            p_phone: phone,
            p_password_hash: hashedPassword
          }
        );

        if (customerError || !customerResult?.success) {
          console.error('Customer account creation failed:', customerError);
          
          // Log security event
          await supabaseAdmin.rpc('log_security_event', {
            p_event_type: 'customer_registration_failed',
            p_severity: 'medium',
            p_description: 'Customer registration attempt failed',
            p_metadata: { 
              email, 
              error: customerError?.message || customerResult?.error,
              ip_address: clientIP 
            }
          });

          return new Response(
            JSON.stringify({ 
              success: false, 
              error: customerResult?.error || "Registration failed" 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log successful registration
        await supabaseAdmin.rpc('log_security_event', {
          p_event_type: 'customer_registration_success',
          p_severity: 'low',
          p_description: 'Customer successfully registered',
          p_metadata: { 
            email, 
            customer_id: customerResult.customer_id,
            ip_address: clientIP 
          }
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            customer_id: customerResult.customer_id,
            message: "Registration successful" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
});