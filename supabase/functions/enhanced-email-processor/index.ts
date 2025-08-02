import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Enhanced email processor started');

    // Get configuration
    const { data: config } = await supabase
      .from('enhanced_email_config')
      .select('*')
      .limit(1)
      .single();

    const batchSize = config?.batch_size || 50;
    const maxRetries = config?.max_retries || 3;

    // Fetch queued emails with priority order
    const { data: queuedEmails, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .lt('retry_count', maxRetries)
      .order('priority', { ascending: false }) // high priority first
      .order('created_at', { ascending: true })  // older first
      .limit(batchSize);

    if (fetchError) {
      console.error('Error fetching queued emails:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No queued emails to process',
          processed: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    console.log(`Processing ${queuedEmails.length} queued emails`);

    let successCount = 0;
    let failureCount = 0;

    // Process each email
    for (const email of queuedEmails) {
      try {
        // Mark as processing
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Send email via smtp-email-sender
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
          'smtp-email-sender',
          {
            body: {
              recipient_email: email.recipient_email,
              template_key: email.template_key || email.event_type,
              variables: email.template_variables || email.variables || {},
              event_id: email.id
            }
          }
        );

        if (sendError || !sendResult?.success) {
          throw new Error(sendError?.message || sendResult?.error || 'Email sending failed');
        }

        // Mark as sent
        await supabase
          .from('communication_events')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_id: sendResult.message_id,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        successCount++;
        console.log(`Successfully sent email to ${email.recipient_email}`);

      } catch (error: any) {
        console.error(`Failed to send email to ${email.recipient_email}:`, error.message);

        // Update failure status with retry logic
        const newRetryCount = email.retry_count + 1;
        const status = newRetryCount >= maxRetries ? 'failed' : 'queued';

        await supabase
          .from('communication_events')
          .update({ 
            status: status,
            retry_count: newRetryCount,
            last_error: error.message,
            error_message: error.message,
            updated_at: new Date().toISOString(),
            // Schedule retry for later if not max retries
            ...(status === 'queued' && {
              // Exponential backoff: 5min, 15min, 45min
              created_at: new Date(Date.now() + (Math.pow(3, newRetryCount) * 5 * 60 * 1000)).toISOString()
            })
          })
          .eq('id', email.id);

        failureCount++;
      }

      // Small delay between emails to avoid overwhelming the SMTP server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Email processing completed: ${successCount} sent, ${failureCount} failed`);

    // Log processing result
    await supabase
      .from('audit_logs')
      .insert({
        action: 'email_batch_processed',
        category: 'Email Processing',
        message: `Processed ${queuedEmails.length} emails: ${successCount} sent, ${failureCount} failed`,
        new_values: {
          batch_size: queuedEmails.length,
          success_count: successCount,
          failure_count: failureCount,
          failure_rate: failureCount / queuedEmails.length
        }
      });

    // Alert if high failure rate
    const failureRate = failureCount / queuedEmails.length;
    if (failureRate > 0.2 && queuedEmails.length > 5) {
      console.warn(`HIGH FAILURE RATE DETECTED: ${(failureRate * 100).toFixed(1)}%`);
      
      await supabase
        .from('audit_logs')
        .insert({
          action: 'high_email_failure_rate',
          category: 'Email Processing',
          message: `CRITICAL: Email failure rate is ${(failureRate * 100).toFixed(1)}%`,
          new_values: {
            failure_rate: failureRate,
            total_emails: queuedEmails.length,
            failed_emails: failureCount
          }
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: queuedEmails.length,
        sent: successCount,
        failed: failureCount,
        failure_rate: failureRate
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
    );

  } catch (error: any) {
    console.error('Error in enhanced email processor:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }}
    );
  }
});