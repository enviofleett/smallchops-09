import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerRegistrationRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

interface RateLimitResponse {
  allowed: boolean;
  reason?: string;
  retry_after_seconds?: number;
  remaining?: number;
}

// Enhanced function to send OTP email with fallback
async function sendOTPEmail(supabase: any, email: string, otp: string, name: string) {
  console.log('=== Sending OTP Email ===');
  console.log('Email:', email);
  console.log('Name:', name);
  console.log('OTP Code:', otp);

  try {
    // Create OTP email using standardized communication events
    const { data: emailEvent, error: emailError } = await supabase
      .from('communication_events')
      .insert({
        event_type: 'customer_registration_otp',
        recipient_email: email,
        template_key: 'customer_registration_otp',
        variables: {
          otpCode: otp,
          customerName: name,
          customerEmail: email,
          companyName: 'Starters',
          expiryMinutes: '10'
        },
        priority: 'high',
        status: 'queued'
      })
      .select()
      .single();
    
    if (emailError) {
      console.error('Error creating OTP email event:', emailError);
      throw new Error('Failed to queue OTP email');
    }

    // Trigger enhanced email processor for immediate processing
    const { data: enhancedResult, error: enhancedError } = await supabase.functions.invoke('enhanced-email-processor', {
      body: {
        priority: 'high',
        event_types: ['customer_registration_otp'],
        immediate: true
      }
    });

    if (!enhancedError && enhancedResult?.success) {
      console.log('✅ OTP email sent via enhanced processor');
      return true;
    }

    console.warn('Enhanced email processor failed, trying fallback:', enhancedError);

    // Fallback to direct SMTP sender
    const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        templateId: 'customer_registration_otp',
        recipient: {
          email: email,
          name: name
        },
        variables: {
          otpCode: otp,
          customerName: name,
          customerEmail: email,
          companyName: 'Starters',
          expiryMinutes: '10'
        },
        emailType: 'transactional'
      }
    });

    if (error) {
      console.error('❌ Direct SMTP sender also failed:', error);
      return false;
    }

    console.log('✅ OTP email sent via direct SMTP sender');
    return true;

  } catch (error) {
    console.error('❌ Critical error sending OTP email:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, name, phone }: CustomerRegistrationRequest = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, password, and name are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters long" }),
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

    // Get client IP for rate limiting and audit logging
    // Handle comma-separated IPs from proxies/load balancers by taking the first one
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const clientIP = forwarded 
      ? forwarded.split(',')[0].trim() 
      : realIP || '127.0.0.1';

    // Check if email already exists in customer accounts
    const { data: existingCustomer } = await supabaseAdmin
      .from('customer_accounts')
      .select('id, email_verified')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingCustomer && existingCustomer.email_verified) {
      return new Response(
        JSON.stringify({ 
          error: "An account with this email already exists and is verified" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check rate limit for OTP generation
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseAdmin.rpc(
      'check_otp_rate_limit',
      { p_email: email.toLowerCase() }
    );

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

    const rateLimit = rateLimitCheck as unknown as RateLimitResponse;
    if (!rateLimit.allowed) {
      const message = rateLimit.reason === 'rate_limited' 
        ? `Too many registration attempts. Please try again in ${Math.ceil((rateLimit.retry_after_seconds || 300) / 60)} minutes.`
        : `Registration temporarily blocked. Please try again in ${Math.ceil((rateLimit.retry_after_seconds || 300) / 60)} minutes.`;
      
      return new Response(
        JSON.stringify({ 
          error: message,
          retry_after_seconds: rateLimit.retry_after_seconds 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

// Generate OTP code
const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

// Hash the password for secure storage
const hashedPassword = await hash(password);

// Store registration data temporarily and OTP
const { data: otpRecord, error: otpError } = await supabaseAdmin
  .from('customer_otp_codes')
  .insert({
    email: email.toLowerCase(),
    otp_code: otpCode,
    otp_type: 'registration',
    expires_at: expiresAt.toISOString(),
    created_by_ip: clientIP,
    verification_metadata: {
      name: name,
      phone: phone,
      password_hash: hashedPassword // ✅ Now properly hashed
    }
  })
  .select()
  .single();

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      return new Response(
        JSON.stringify({ error: "Failed to initiate registration process" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Send OTP email
    const emailSent = await sendOTPEmail(supabaseAdmin, email, otpCode, name);
    
    if (!emailSent) {
      // Clean up the OTP record if email fails
      await supabaseAdmin
        .from('customer_otp_codes')
        .delete()
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ error: "Failed to send verification email" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create customer account in pending state if it doesn't exist
    if (!existingCustomer) {
      const { error: customerError } = await supabaseAdmin
        .from('customer_accounts')
        .insert({
          name: name,
          email: email.toLowerCase(),
          phone: phone,
          email_verified: false
        });

      if (customerError) {
        console.warn('Customer account creation warning:', customerError);
      }
    }

    // Log registration attempt
    await supabaseAdmin
      .from('customer_auth_audit')
      .insert({
        email: email.toLowerCase(),
        action: 'registration',
        success: true,
        ip_address: clientIP,
        metadata: {
          otp_id: otpRecord.id,
          name: name,
          has_phone: !!phone
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration initiated. Please check your email for the verification code.",
        email: email.toLowerCase(),
        expires_in_minutes: 10,
        requires_otp_verification: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error('Customer registration error:', error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error during registration",
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});