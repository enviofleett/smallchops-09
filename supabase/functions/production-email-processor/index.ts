import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  duration: number;
}

// Enhanced email validation and normalization
function validateAndNormalizeEmailPayload(event: any): any {
  console.log(`🔍 Validating email event: ${event.id}`);
  
  // Ensure all required fields are present
  if (!event.recipient_email) {
    throw new Error('Missing recipient email address');
  }

  // Normalize template key
  let templateId = event.template_key;
  if (!templateId) {
    // Set default template based on event type
    templateId = event.event_type === 'customer_welcome' ? 'welcome_customer' : 'order_confirmed';
    console.log(`⚠️ No template_key found, using default: ${templateId}`);
  }

  // Build standardized payload
  const payload = {
    templateId,
    recipient: {
      email: event.recipient_email,
      name: event.variables?.customer_name || event.variables?.customerName || 'Valued Customer'
    },
    variables: {
      ...event.variables,
      business_name: 'Starters Small Chops',
      customer_email: event.recipient_email,
      event_type: event.event_type,
      order_id: event.order_id
    },
    emailType: event.email_type || 'transactional'
  };

  console.log(`✅ Email payload validated for template: ${templateId}`);
  return payload;
}

// Enhanced SMTP health check before processing
async function checkSMTPHealth(supabase: any): Promise<boolean> {
  try {
    console.log('🏥 Checking SMTP health before processing...');
    
    const { data: healthResult, error } = await supabase.functions.invoke('smtp-health-monitor', {
      body: {}
    });

    if (error) {
      console.error('Health check failed:', error);
      return false;
    }

    const isHealthy = healthResult?.healthy && healthResult?.success;
    console.log(`Health status: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    return isHealthy;
  } catch (error) {
    console.error('SMTP health check error:', error);
    return false;
  }
}

// Process emails with enhanced error handling and validation
async function processEmailBatch(supabase: any, priority: 'high' | 'normal' = 'normal'): Promise<ProcessingResult> {
  const startTime = Date.now();
  const result: ProcessingResult = {
    success: true,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
    duration: 0
  };

  try {
    console.log(`🚀 Starting ${priority} priority email processing...`);

    // Check SMTP health first
    const isHealthy = await checkSMTPHealth(supabase);
    if (!isHealthy) {
      throw new Error('SMTP system is unhealthy - aborting processing to prevent failures');
    }

    // Get configuration
    const { data: config } = await supabase
      .from('enhanced_email_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    const batchSize = config?.batch_size || 10;
    const maxRetries = config?.max_retries || 3;

    // Fetch emails to process
    const priorityFilter = priority === 'high' ? ['high'] : ['normal', 'low'];
    
    const { data: emails, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .in('priority', priorityFilter)
      .lt('retry_count', maxRetries)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`);
    }

    if (!emails || emails.length === 0) {
      console.log('✅ No emails to process');
      result.duration = Date.now() - startTime;
      return result;
    }

    console.log(`📧 Processing ${emails.length} emails...`);
    result.processed = emails.length;

    // Process each email
    for (const email of emails) {
      try {
        // Update status to processing
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Validate and normalize email payload
        const emailPayload = validateAndNormalizeEmailPayload(email);

        // Determine email sender based on priority and reliability
        const emailSender = priority === 'high' ? 'enhanced-smtp-sender' : 'smtp-email-sender';
        
        console.log(`📤 Sending email ${email.id} via ${emailSender}`);

        // Send email with comprehensive error handling
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(emailSender, {
          body: emailPayload
        });

        if (emailError) {
          throw new Error(`Email sender error: ${emailError.message}`);
        }

        // Update status to sent
        await supabase
          .from('communication_events')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            delivery_status: 'delivered',
            external_id: emailResult?.messageId || null
          })
          .eq('id', email.id);

        // Log successful delivery
        await supabase
          .from('email_delivery_confirmations')
          .insert({
            email_id: email.id,
            recipient_email: email.recipient_email,
            delivery_status: 'delivered',
            provider_response: emailResult,
            delivered_at: new Date().toISOString()
          });

        result.successful++;
        console.log(`✅ Email ${email.id} sent successfully`);

      } catch (emailError) {
        console.error(`❌ Failed to send email ${email.id}:`, emailError);
        
        const newRetryCount = (email.retry_count || 0) + 1;
        const shouldRetry = newRetryCount < maxRetries;
        
        // Calculate exponential backoff for retry
        const backoffMinutes = Math.min(60, Math.pow(2, newRetryCount) * 5);
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        // Update email with error info
        await supabase
          .from('communication_events')
          .update({
            status: shouldRetry ? 'queued' : 'failed',
            retry_count: newRetryCount,
            error_message: emailError.message,
            last_error: emailError.message,
            updated_at: new Date().toISOString(),
            ...(shouldRetry && { processed_at: nextRetryAt.toISOString() })
          })
          .eq('id', email.id);

        result.failed++;
        result.errors.push(`Email ${email.id}: ${emailError.message}`);
      }

      // Small delay between emails to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Log comprehensive results
    console.log(`🎯 Processing complete:`);
    console.log(`   ✅ Successful: ${result.successful}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   ⏱️ Duration: ${Date.now() - startTime}ms`);

    // Record metrics
    await supabase.from('email_processing_metrics').insert({
      processing_type: `production_${priority}`,
      emails_processed: result.processed,
      emails_successful: result.successful,
      emails_failed: result.failed,
      processing_duration_ms: Date.now() - startTime,
      failure_rate: result.processed > 0 ? (result.failed / result.processed) * 100 : 0
    });

    // Log audit entry
    await supabase.from('audit_logs').insert({
      action: 'production_email_processing',
      category: 'Email Processing',
      message: `Processed ${result.processed} ${priority} priority emails: ${result.successful} sent, ${result.failed} failed`,
      new_values: {
        priority,
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Email processing error:', error);
    result.success = false;
    result.errors.push(`Processing error: ${error.message}`);
  }

  result.duration = Date.now() - startTime;
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { priority = 'normal' } = await req.json().catch(() => ({}));

    console.log('=== Production Email Processor Started ===');
    console.log(`Priority: ${priority}`);

    // Process email batch
    const result = await processEmailBatch(supabase, priority);

    return new Response(JSON.stringify({
      success: result.success,
      message: `Processed ${result.processed} emails: ${result.successful} successful, ${result.failed} failed`,
      details: result
    }), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== Production Email Processor Error ===');
    console.error('Error message:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Email processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});