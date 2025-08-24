import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
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
      console.log('No emails to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No emails to process',
          processed: 0,
          failed: 0 
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
      );
    }

    console.log(`Processing ${queuedEmails.length} emails`);
    
    let processed = 0;
    let failed = 0;

    // Process each email
    for (const email of queuedEmails) {
      try {
        console.log(`Processing email ${email.id} to ${email.recipient_email}`);

        // Mark as processing
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Check if email is suppressed
        const { data: suppressionCheck } = await supabase
          .rpc('is_email_suppressed', { email_address: email.recipient_email });

        if (suppressionCheck === true) {
          console.log(`Email ${email.recipient_email} is suppressed, skipping`);
          
          await supabase
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: 'Email address is suppressed',
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);
          
          failed++;
          continue;
        }

        // Check rate limits
        const { data: rateLimitCheck } = await supabase
          .functions.invoke('enhanced-email-rate-limiter', {
            body: { 
              recipient_email: email.recipient_email,
              sender_domain: 'startersmallchops.com'
            }
          });

        if (!rateLimitCheck?.success || !rateLimitCheck?.data?.allowed) {
          console.log(`Rate limit exceeded for ${email.recipient_email}`);
          
          // Don't increment retry count for rate limits, just delay
          await supabase
            .from('communication_events')
            .update({ 
              status: 'queued',
              scheduled_at: new Date(Date.now() + (rateLimitCheck?.data?.retry_after || 300) * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);
          
          continue;
        }

        // Attempt to send email using unified-smtp-sender
        let emailResult;
        
        try {
          emailResult = await supabase.functions.invoke('unified-smtp-sender', {
            body: {
              to: email.recipient_email,
              subject: email.variables?.subject || 'Notification',
              htmlContent: email.variables?.html_content,
              textContent: email.variables?.text_content,
              templateKey: email.template_key,
              variables: email.variables
            }
          });
        } catch (sendError) {
          console.error('Error calling unified-smtp-sender:', sendError);
          emailResult = { error: sendError };
        }

        if (emailResult.error || !emailResult.data?.success) {
          const errorMessage = emailResult.error?.message || emailResult.data?.error || 'Unknown sending error';
          console.log(`Failed to send email ${email.id}: ${errorMessage}`);

          // Increment rate limit counter on failure
          try {
            await supabase.functions.invoke('enhanced-email-rate-limiter', {
              body: { 
                increment_for: email.recipient_email,
                sender_domain: 'startersmallchops.com'
              }
            });
          } catch (rateLimitError) {
            console.error('Error incrementing rate limit:', rateLimitError);
          }

          // Handle bounces and complaints
          if (errorMessage.includes('bounce') || errorMessage.includes('rejected')) {
            await supabase
              .from('email_suppression_list')
              .upsert({
                email: email.recipient_email.toLowerCase(),
                suppression_type: 'bounce',
                reason: errorMessage,
                is_active: true
              });
          }

          // Retry logic with exponential backoff
          const newRetryCount = (email.retry_count || 0) + 1;
          const shouldRetry = newRetryCount < maxRetries;
          
          if (shouldRetry) {
            const backoffMinutes = Math.pow(2, newRetryCount) * 5; // 5, 10, 20 minutes
            const scheduledAt = new Date(Date.now() + backoffMinutes * 60000).toISOString();
            
            await supabase
              .from('communication_events')
              .update({
                status: 'queued',
                retry_count: newRetryCount,
                scheduled_at: scheduledAt,
                error_message: errorMessage,
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);
              
            console.log(`Scheduled retry ${newRetryCount}/${maxRetries} for email ${email.id} at ${scheduledAt}`);
          } else {
            await supabase
              .from('communication_events')
              .update({
                status: 'failed',
                retry_count: newRetryCount,
                error_message: errorMessage,
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);
              
            console.log(`Max retries reached for email ${email.id}, marking as failed`);
          }
          
          failed++;
        } else {
          console.log(`Successfully sent email ${email.id}`);

          // Increment rate limit counter on success
          try {
            await supabase.functions.invoke('enhanced-email-rate-limiter', {
              body: { 
                increment_for: email.recipient_email,
                sender_domain: 'startersmallchops.com'
              }
            });
          } catch (rateLimitError) {
            console.error('Error incrementing rate limit:', rateLimitError);
          }

          await supabase
            .from('communication_events')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              provider_message_id: emailResult.data?.messageId
            })
            .eq('id', email.id);
          
          processed++;
        }

      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        
        await supabase
          .from('communication_events')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: (email.retry_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);
        
        failed++;
      }
    }

    // Log processing results
    await supabase
      .from('audit_logs')
      .insert({
        action: 'enhanced_email_processing_completed',
        category: 'Email Processing',
        message: `Enhanced email processing completed: ${processed} sent, ${failed} failed`,
        new_values: {
          processed,
          failed,
          batch_size: queuedEmails.length,
          timestamp: new Date().toISOString()
        }
      });

    // Alert on high failure rate (>50%)
    const total = processed + failed;
    if (total > 0 && (failed / total) > 0.5) {
      console.error(`🚨 HIGH FAILURE RATE: ${failed}/${total} emails failed (${Math.round(failed/total*100)}%)`);
      
      await supabase.functions.invoke('email-production-monitor', {
        body: {
          alert_type: 'high_failure_rate',
          failure_rate: Math.round(failed/total*100),
          total_processed: total,
          failed_count: failed
        }
      });
    }

    console.log(`Enhanced email processing completed: ${processed} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        message: `Enhanced email processing completed: ${processed} sent, ${failed} failed`
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
    );

  } catch (error) {
    console.error('Enhanced email processor error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});