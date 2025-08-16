import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPVerificationRequest {
  email: string;
  otpCode: string;
  otpType: 'registration' | 'login' | 'password_reset' | 'email_verification';
}

interface CustomerRegistrationRequest extends OTPVerificationRequest {
  password?: string;
  name?: string;
  phone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otpCode, otpType, password, name, phone }: CustomerRegistrationRequest = await req.json();

    if (!email || !otpCode || !otpType) {
      return new Response(
        JSON.stringify({ error: "Email, OTP code, and type are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client with service role key for OTP verification
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get client IP for audit logging
    // Handle comma-separated IPs from proxies/load balancers by taking the first one
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const clientIP = forwarded 
      ? forwarded.split(',')[0].trim() 
      : realIP || '127.0.0.1';

    // Generate correlation ID for tracking
    const correlationId = crypto.randomUUID();
    
    // Verify OTP using enhanced secure function
    const { data: verificationResult, error: verificationError } = await supabaseAdmin.rpc(
      'verify_customer_otp_secure',
      {
        p_email: email,
        p_otp_code: otpCode,
        p_otp_type: otpType,
        p_ip_address: clientIP,
        p_correlation_id: correlationId
      }
    );

    if (verificationError || !verificationResult?.success) {
      console.error('OTP verification failed:', verificationError || verificationResult?.error);
      return new Response(
        JSON.stringify({ 
          error: verificationResult?.error || "OTP verification failed",
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Handle registration flow - create Supabase auth user if needed
    if (otpType === 'registration' && password) {
      try {
        // Create auth user with admin client
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Mark email as confirmed since OTP was verified
          user_metadata: {
            name: name || email.split('@')[0],
            phone: phone,
            registration_method: 'otp',
            email_verified_at: new Date().toISOString()
          }
        });

        if (authError || !authData.user) {
          console.error('Auth user creation failed:', authError);
          return new Response(
            JSON.stringify({ 
              error: "Failed to create user account",
              details: authError?.message,
              success: false 
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }

        // Update customer account with auth user_id
        const { error: updateError } = await supabaseAdmin
          .from('customer_accounts')
          .update({ 
            user_id: authData.user.id,
            email_verified: true,
            name: name || email.split('@')[0],
            phone: phone
          })
          .eq('id', verificationResult.customer_id);

        if (updateError) {
          console.error('Customer account update failed:', updateError);
        }

        // Send welcome email using the email service
        const welcomeEmailResult = await supabaseAdmin.functions.invoke('smtp-email-sender', {
          headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: {
            templateId: 'customer_welcome',
            recipient: {
              email: email,
              name: name || email.split('@')[0]
            },
            variables: {
              customerName: name || email.split('@')[0],
              customerEmail: email,
              companyName: 'Starters'
            },
            emailType: 'transactional'
          }
        });

        if (welcomeEmailResult.error) {
          console.warn('Welcome email failed:', welcomeEmailResult.error);
        }

        // Log successful registration with correlation ID
        await supabaseAdmin
          .from('customer_auth_audit')
          .insert({
            customer_id: verificationResult.customer_id,
            email: email,
            action: 'registration_completed',
            success: true,
            ip_address: clientIP,
            metadata: {
              auth_user_id: authData.user.id,
              registration_method: 'otp',
              welcome_email_sent: !welcomeEmailResult.error,
              correlation_id: verificationResult.correlation_id || correlationId
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Registration completed successfully",
            customer_id: verificationResult.customer_id,
            auth_user_id: authData.user.id,
            email_verified: true,
            welcome_email_sent: !welcomeEmailResult.error,
            correlation_id: verificationResult.correlation_id || correlationId
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );

      } catch (authCreationError) {
        console.error('Auth creation error:', authCreationError);
        return new Response(
          JSON.stringify({ 
            error: "Registration failed during account creation",
            success: false 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }

    // Handle other OTP types (login, password reset, email verification)
    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP verified successfully",
        customer_id: verificationResult.customer_id,
        email_verified: verificationResult.email_verified,
        verification_type: otpType
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error('Customer OTP verification error:', error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error during verification",
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});