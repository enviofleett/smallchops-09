import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FinalizeRegistrationRequest {
  email: string;
  name: string;
  phone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, phone }: FinalizeRegistrationRequest = await req.json();

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: "Email and name are required" }),
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

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify the user is authenticated
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify email matches authenticated user
    if (user.email !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email mismatch" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if customer account already exists
    const { data: existingCustomer } = await supabaseAdmin
      .from('customer_accounts')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    let customerId;

    if (existingCustomer) {
      // Update existing customer account
      const { data: updatedCustomer, error: updateError } = await supabaseAdmin
        .from('customer_accounts')
        .update({
          name: name,
          phone: phone,
          supabase_user_id: user.id,
          email_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('Error updating customer account:', updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update customer account" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      customerId = updatedCustomer.id;
    } else {
      // Create new customer account
      const { data: newCustomer, error: insertError } = await supabaseAdmin
        .from('customer_accounts')
        .insert({
          email: email.toLowerCase(),
          name: name,
          phone: phone,
          supabase_user_id: user.id,
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating customer account:', insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create customer account" }),
          { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      customerId = newCustomer.id;
    }

    // Queue welcome email
    const { error: emailError } = await supabaseAdmin
      .from('communication_events')
      .insert({
        event_type: 'customer_welcome',
        recipient_email: email.toLowerCase(),
        template_key: 'customer_welcome',
        email_type: 'transactional',
        status: 'queued',
        priority: 'high',
        variables: {
          customerName: name,
          customerEmail: email.toLowerCase(),
          companyName: 'Starters',
          loginUrl: `${Deno.env.get("SUPABASE_URL") || "https://oknnklksdiqaifhxaccs.supabase.co"}`
        },
        metadata: {
          customer_id: customerId,
          registration_flow: 'supabase_auth_otp',
          user_id: user.id
        },
        created_at: new Date().toISOString()
      });

    if (emailError) {
      console.error('Error queuing welcome email:', emailError);
      // Don't fail the registration for email issues, just log it
    }

    // Log successful registration
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        action: 'customer_registration_finalized',
        category: 'Customer Management',
        message: `Customer registration finalized via Supabase Auth OTP: ${email}`,
        entity_id: customerId,
        user_id: user.id,
        new_values: {
          customer_id: customerId,
          email: email.toLowerCase(),
          name: name,
          phone: phone,
          method: 'supabase_auth_otp'
        },
        created_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customerId,
        user_id: user.id,
        email: email.toLowerCase(),
        welcome_email_queued: !emailError,
        message: 'Registration completed successfully'
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