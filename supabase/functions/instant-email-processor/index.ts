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

    const { priority = 'all', event_types, limit = 10 } = await req.json() || {};
    
    console.log('📧 Processing communication events', { priority, event_types, limit });

    // Build query for communication events to process
    let query = supabaseAdmin
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);

    // Add priority filter
    if (priority === 'high') {
      query = query.eq('priority', 'high');
    }

    // Add event type filter
    if (event_types && Array.isArray(event_types)) {
      query = query.in('event_type', event_types);
    }

    const { data: events, error: fetchError } = await query;
    
    if (fetchError) {
      throw new Error(`Failed to fetch events: ${fetchError.message}`);
    }

    console.log(`📋 Found ${events?.length || 0} events to process`);

    let processed = 0;
    let failed = 0;

    for (const event of events || []) {
      try {
        // Mark as processing
        const { error: updateError } = await supabaseAdmin
          .from('communication_events')
          .update({ 
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id);

        if (updateError) {
          console.error(`❌ Failed to mark event ${event.id} as processing:`, updateError);
          continue;
        }

        if (event.channel === 'email' && event.recipient_email) {
          // Process email
          await processEmailEvent(supabaseAdmin, event);
          processed++;
        } else if (event.channel === 'sms' && event.sms_phone) {
          // Process SMS
          await processSMSEvent(supabaseAdmin, event);
          processed++;
        } else {
          // Invalid event
          await supabaseAdmin
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: 'Invalid channel or missing recipient',
              updated_at: new Date().toISOString()
            })
            .eq('id', event.id);
          failed++;
        }

      } catch (eventError) {
        console.error(`❌ Failed to process event ${event.id}:`, eventError);
        
        // Update retry count and status
        const newRetryCount = (event.retry_count || 0) + 1;
        const newStatus = newRetryCount >= 3 ? 'failed' : 'queued';
        
        await supabaseAdmin
          .from('communication_events')
          .update({ 
            status: newStatus,
            retry_count: newRetryCount,
            last_error: eventError.message,
            error_message: eventError.message,
            last_retry_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id);

        failed++;
      }
    }

    console.log(`✅ Processing complete: ${processed} processed, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      message: `Processed ${processed} events, ${failed} failed`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Email processor error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Failed to process communication events'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processEmailEvent(supabaseAdmin, event) {
  console.log(`📧 Processing email for: ${event.recipient_email}`);
  
  // Get email template
  const { data: template, error: templateError } = await supabaseAdmin
    .from('enhanced_email_templates')
    .select('*')
    .eq('template_key', event.template_key)
    .eq('is_active', true)
    .single();

  if (templateError || !template) {
    throw new Error(`Template not found: ${event.template_key}`);
  }

  // Prepare email data
  const emailData = {
    to: event.recipient_email,
    templateKey: event.template_key,
    variables: event.template_variables || {},
    subject: replaceVariables(template.subject_template, event.template_variables || {}),
    htmlContent: replaceVariables(template.html_template, event.template_variables || {}),
    emailType: 'transactional',
    priority: event.priority || 'normal'
  };

  // Send email via unified SMTP sender
  const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('unified-smtp-sender', {
    body: emailData
  });

  if (emailError) {
    throw new Error(`SMTP sender failed: ${emailError.message}`);
  }

  // Mark as sent
  await supabaseAdmin
    .from('communication_events')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - new Date(event.processing_started_at || event.created_at).getTime(),
      provider_response: emailResult,
      updated_at: new Date().toISOString()
    })
    .eq('id', event.id);

  console.log(`✅ Email sent successfully for event ${event.id}`);
}

async function processSMSEvent(supabaseAdmin, event) {
  console.log(`📱 Processing SMS for: ${event.sms_phone}`);
  
  // Prepare SMS data
  const smsData = {
    phone: event.sms_phone,
    message: event.template_variables?.message || `Update: Your order status has been updated.`,
    templateKey: event.template_key
  };

  // Send SMS via SMS service
  const { data: smsResult, error: smsError } = await supabaseAdmin.functions.invoke('sms-service', {
    body: smsData
  });

  if (smsError) {
    throw new Error(`SMS service failed: ${smsError.message}`);
  }

  // Mark as sent
  await supabaseAdmin
    .from('communication_events')
    .update({ 
      status: 'sent',
      sent_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - new Date(event.processing_started_at || event.created_at).getTime(),
      provider_response: smsResult,
      updated_at: new Date().toISOString()
    })
    .eq('id', event.id);

  console.log(`✅ SMS sent successfully for event ${event.id}`);
}

function replaceVariables(template, variables) {
  if (!template || !variables) return template || '';
  
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }
  return result;
}