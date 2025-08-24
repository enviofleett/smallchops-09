// Unified Email Queue Processor - Production Ready
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    const batchSize = requestBody.batchSize || 50;
    const priority = requestBody.priority || 'all';

    console.log('🚀 Starting unified email queue processing...');
    console.log(`📧 Batch size: ${batchSize}, Priority: ${priority}`);

    // Get queued emails based on priority and retry logic
    let query = supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .lt('retry_count', 3)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (priority !== 'all') {
      query = query.eq('priority', priority);
    }

    const { data: queuedEmails, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      console.log('✅ No queued emails found');
      return new Response(
        JSON.stringify({ 
          message: 'No queued emails to process', 
          processed: 0,
          failed: 0,
          status: 'success'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Found ${queuedEmails.length} queued emails to process`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each email
    for (const email of queuedEmails) {
      try {
        console.log(`🔄 Processing email ${email.id} for ${email.recipient_email}`);
        
        // Mark as processing
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Prepare email data for unified sender
        const emailData = {
          to: email.recipient_email,
          subject: email.subject || undefined,
          html: email.html_content || undefined,
          text: email.text_content || undefined,
          templateKey: email.template_key,
          variables: email.variables || {},
          emailType: email.email_type || 'transactional',
          priority: email.priority || 'normal'
        };

        // Send via unified SMTP sender
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('unified-smtp-sender', {
          body: emailData
        });

        if (emailError) {
          console.error(`❌ Failed to send email ${email.id}:`, emailError);
          
          // Update status to failed with retry logic
          await supabase
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: emailError.message,
              last_error: emailError.message,
              retry_count: (email.retry_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);

          failureCount++;
          results.push({
            eventId: email.id,
            recipient: email.recipient_email,
            status: 'failed',
            error: emailError.message
          });
          
          continue;
        }

        // Update status to sent on success
        await supabase
          .from('communication_events')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            external_id: emailResult?.messageId,
            processing_time_ms: Date.now() - new Date(email.processing_started_at || email.updated_at).getTime(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        console.log(`✅ Email sent successfully: ${email.id} -> ${email.recipient_email}`);
        
        successCount++;
        results.push({
          eventId: email.id,
          recipient: email.recipient_email,
          status: 'sent',
          messageId: emailResult?.messageId
        });

        // Rate limiting - small delay between emails for production stability
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (eventError) {
        console.error(`❌ Error processing email ${email.id}:`, eventError);
        
        // Update with error
        await supabase
          .from('communication_events')
          .update({ 
            status: 'failed',
            error_message: eventError.message,
            last_error: eventError.message,
            retry_count: (email.retry_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        failureCount++;
        results.push({
          eventId: email.id,
          recipient: email.recipient_email,
          status: 'error',
          error: eventError.message
        });
      }
    }

    // Log comprehensive results
    console.log(`=== Email Queue Processing Complete ===`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    // Log to audit for monitoring
    await supabase.from('audit_logs').insert({
      action: 'unified_email_queue_processing',
      category: 'Email Processing',
      message: `Processed ${queuedEmails.length} emails: ${successCount} sent, ${failureCount} failed`,
      new_values: {
        total_processed: queuedEmails.length,
        successful: successCount,
        failed: failureCount,
        batch_size: batchSize,
        priority_filter: priority,
        processing_time: new Date().toISOString(),
        production_mode: true
      }
    });

    // Alert if failure rate is high
    const failureRate = failureCount / queuedEmails.length;
    if (failureRate > 0.2 && queuedEmails.length > 5) {
      console.warn(`⚠️ HIGH FAILURE RATE: ${(failureRate * 100).toFixed(1)}% of emails failed`);
      
      await supabase.from('audit_logs').insert({
        action: 'email_queue_high_failure_rate',
        category: 'System Alert',
        message: `Critical: Email queue failure rate is ${(failureRate * 100).toFixed(1)}%`,
        new_values: {
          failure_rate: failureRate,
          total_processed: queuedEmails.length,
          failed_count: failureCount,
          alert_level: 'critical'
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        message: 'Email queue processing completed',
        total_events: queuedEmails.length,
        successful: successCount,
        failed: failureCount,
        failure_rate: failureRate,
        status: 'completed',
        production_ready: true,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== Unified Email Queue Processor Error ===');
    console.error('Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'error',
        timestamp: new Date().toISOString(),
        production_error: true
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});