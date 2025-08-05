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

        // Check if email is suppressed first
        const { data: suppressionCheck } = await supabase
          .rpc('is_email_suppressed', { email_address: email.recipient_email });

        if (suppressionCheck) {
          console.log(`Email ${email.recipient_email} is suppressed, skipping`);
          
          await supabase
            .from('communication_events')
            .update({ 
              status: 'cancelled',
              error_message: 'Email address is suppressed',
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);
          
          continue; // Skip to next email
        }

        // Check rate limits
        const rateLimitResponse = await supabase.functions.invoke('enhanced-email-rate-limiter', {
          body: {
            identifier: email.recipient_email.split('@')[1],
            identifier_type: 'domain',
            limit_type: 'hourly',
            action: 'check'
          }
        });

        if (rateLimitResponse.data && !rateLimitResponse.data.allowed) {
          console.log(`Rate limit exceeded for ${email.recipient_email}, scheduling for later`);
          
          // Schedule for later retry
          const retryAfter = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          await supabase
            .from('communication_events')
            .update({ 
              status: 'queued',
              error_message: 'Rate limit exceeded, scheduled for retry',
              created_at: retryAfter.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);
          
          continue; // Skip to next email
        }

        // Enhanced email processing with template support
        let sendResult, sendError;
        
        // First try using template-based approach with smtp-email-sender
        console.log(`Attempting template-based email for ${email.recipient_email} with template: ${email.template_key || email.event_type}`);
        
        ({ data: sendResult, error: sendError } = await supabase.functions.invoke(
          'smtp-email-sender',
          {
            body: {
              templateId: email.template_key || email.event_type,
              recipient: {
                email: email.recipient_email,
                name: email.template_variables?.customerName || email.variables?.customerName || 'Valued Customer'
              },
              variables: {
                ...email.template_variables,
                ...email.variables,
                // Ensure standard variables are always available
                companyName: 'Starters',
                supportEmail: 'support@starters.com',
                websiteUrl: 'https://starters.com'
              },
              emailType: 'transactional'
            }
          }
        ));

        // If template-based fails, try production SMTP sender as fallback
        if (sendError || !sendResult?.success) {
          console.log(`Template sender failed, trying production SMTP for ${email.recipient_email}`);
          
          ({ data: sendResult, error: sendError } = await supabase.functions.invoke(
            'production-smtp-sender',
            {
              body: {
                to: email.recipient_email,
                subject: email.payload?.subject || `Update from ${email.template_variables?.companyName || 'Starters'}`,
                html: email.payload?.html || email.payload?.content || `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Hello ${email.template_variables?.customerName || 'Valued Customer'}!</h2>
                    <p>Thank you for your interest in our services.</p>
                    <p>Best regards,<br>${email.template_variables?.companyName || 'Starters'} Team</p>
                  </div>
                `,
                template_variables: email.template_variables || email.variables || {},
                event_id: email.id,
                priority: email.priority || 'normal'
              }
            }
          ));
        }

        // Update rate limit counter if successful
        if (!sendError && sendResult?.success) {
          await supabase.functions.invoke('enhanced-email-rate-limiter', {
            body: {
              identifier: email.recipient_email.split('@')[1],
              identifier_type: 'domain',
              limit_type: 'hourly',
              action: 'increment'
            }
          });
        }

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

        // Check if this is a bounce/complaint that should trigger suppression
        const errorMsg = error.message || '';
        const isBounce = errorMsg.includes('550') || errorMsg.includes('bounce') || errorMsg.includes('invalid') || errorMsg.includes('Authentication failed');
        const isComplaint = errorMsg.includes('complaint') || errorMsg.includes('spam');

        if (isBounce || isComplaint) {
          console.log(`Adding ${email.recipient_email} to suppression list due to ${isBounce ? 'bounce' : 'complaint'}`);
          
          // Add to suppression list
          try {
            await supabase
              .from('email_suppression_list')
              .upsert({
                email_address: email.recipient_email,
                suppression_reason: isBounce ? 'hard_bounce' : 'complaint',
                bounce_count: 1,
                last_bounce_at: new Date().toISOString(),
                metadata: { error_message: errorMsg, event_id: email.id }
              }, { onConflict: 'email_address' });

            // Record bounce tracking
            await supabase
              .from('email_bounce_tracking')
              .upsert({
                email_address: email.recipient_email,
                bounce_type: isBounce ? 'hard' : 'complaint',
                bounce_reason: errorMsg,
                provider_response: { error: errorMsg, timestamp: new Date().toISOString() }
              }, { onConflict: 'email_address,bounce_type' });
          } catch (suppressionError) {
            console.error('Failed to add to suppression list:', suppressionError);
          }
        }

        // Update failure status with retry logic (don't retry bounces/complaints)
        const newRetryCount = email.retry_count + 1;
        const shouldRetry = newRetryCount < maxRetries && !isBounce && !isComplaint;
        const status = shouldRetry ? 'queued' : 'failed';

        await supabase
          .from('communication_events')
          .update({ 
            status: status,
            retry_count: newRetryCount,
            last_error: error.message,
            error_message: error.message,
            updated_at: new Date().toISOString(),
            // Schedule retry for later if not max retries and not a bounce/complaint
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