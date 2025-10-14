import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { customer_email, customer_name, customer_id, trigger_type = 'registration', order_id } = await req.json();

    console.log('🎉 CUSTOMER WELCOME: Processing welcome email for:', customer_email);

    // Fetch business settings for dynamic content
    const { data: businessSettings } = await supabaseAdmin
      .from('business_settings')
      .select('name, site_url, tagline, logo_url, primary_color')
      .limit(1)
      .single();

    // Prepare enhanced variables for welcome email template (snake_case)
    const welcomeVariables = {
      customer_name: customer_name || customer_email.split('@')[0],
      business_name: businessSettings?.name || 'Starters Small Chops',
      signup_date: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      website_url: businessSettings?.site_url || 'https://startersmallchops.com',
      current_year: new Date().getFullYear().toString()
    };

    console.log('📧 Sending welcome email with variables:', JSON.stringify(welcomeVariables, null, 2));

    // Send welcome email using unified SMTP sender with comprehensive variables
    const { data: emailResponse, error: emailError } = await supabaseAdmin.functions.invoke('unified-smtp-sender', {
      body: {
        to: customer_email,
        templateKey: 'customer_welcome',
        variables: welcomeVariables,
        emailType: 'transactional',
        priority: 'high'
      }
    });

    if (emailError) {
      console.error('❌ SMTP sending failed:', emailError);
      throw new Error(`SMTP sending failed: ${emailError.message}`);
    }
    
    console.log('✅ Welcome email sent successfully via SMTP to:', customer_email);

    // Log successful email processing in audit logs
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        action: 'customer_welcome_email_sent',
        category: 'Customer Registration',
        message: `Welcome email successfully sent to new customer: ${customer_email}`,
        entity_id: customer_id,
        new_values: {
          customer_email: customer_email,
          customer_name: customer_name,
          trigger_type: trigger_type,
          email_sent_at: new Date().toISOString(),
          smtp_response: emailResponse
        }
      });

    // Update communication event status if this was triggered by the queue
    if (order_id) {
      await supabaseAdmin
        .from('communication_events')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          delivery_status: 'delivered'
        })
        .eq('recipient_email', customer_email.toLowerCase())
        .eq('event_type', 'customer_welcome')
        .eq('status', 'processing');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Welcome email sent successfully',
        email_sent_to: customer_email,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Welcome email processing error:', error);

    // Log error in audit logs
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      await supabaseAdmin
        .from('audit_logs')
        .insert({
          action: 'customer_welcome_email_failed',
          category: 'Customer Registration',
          message: `Failed to send welcome email: ${error.message}`,
          new_values: {
            error_message: error.message,
            failed_at: new Date().toISOString()
          }
        });
    } catch (auditError) {
      console.error('Failed to log error to audit:', auditError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to send welcome email',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});