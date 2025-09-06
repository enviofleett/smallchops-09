// Real-time Email Processing Engine
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('=== Instant Email Processor Started ===')

    // Get high priority queued emails for immediate processing
    const { data: highPriorityEmails, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .eq('priority', 'high')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(20) // Process 20 high priority emails at once

    if (fetchError) {
      console.error('Error fetching high priority emails:', fetchError)
      throw fetchError
    }

    let emailsToProcess = highPriorityEmails || []
    
    if (emailsToProcess.length === 0) {
      console.log('✅ No high priority emails to process')
      
      // Also process normal priority emails if queue is empty
      const { data: normalEmails, error: normalError } = await supabase
        .from('communication_events')
        .select('*')
        .eq('status', 'queued')
        .in('priority', ['normal', 'low'])
        .lt('retry_count', 3)
        .order('created_at', { ascending: true })
        .limit(10) // Process fewer normal priority emails

      if (normalError) {
        console.error('Error fetching normal priority emails:', normalError)
        throw normalError
      }

      emailsToProcess = normalEmails || []
      
      if (emailsToProcess.length === 0) {
        console.log('✅ No emails to process')
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No emails to process',
            processed: 0,
            failed: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`📧 Processing ${emailsToProcess.length} emails`)
    
    const result = await processEmails(supabase, emailsToProcess, 'instant')
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Instant email processor error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processed: 0,
        failed: 0
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function processEmails(supabase: any, emails: any[], priority: string) {
  let processed = 0
  let failed = 0

  for (const email of emails) {
    try {
      console.log(`🔄 Processing email ${email.id} to ${email.recipient_email}`)

      // Mark as processing
      await supabase
        .from('communication_events')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)

      // Check email suppression with error handling
      let suppressionCheck = false;
      try {
        const { data } = await supabase
          .rpc('is_email_suppressed', { email_address: email.recipient_email });
        suppressionCheck = data === true;
      } catch (suppressionError) {
        console.warn(`⚠️ Suppression check failed for ${email.recipient_email}, allowing email:`, suppressionError.message);
        // Continue processing if suppression check fails
      }

      if (suppressionCheck === true) {
        console.log(`🚫 Email ${email.recipient_email} is suppressed, skipping`)
        
        await supabase
          .from('communication_events')
          .update({ 
            status: 'failed',
            error_message: 'Email address is suppressed',
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)
        
        failed++
        continue
      }

      // Attempt to send via unified-smtp-sender
      let emailResult
      
      try {
        // Normalize template key for backwards compatibility
        let normalizedTemplateKey = email.template_key;
        const legacyMappings: Record<string, string> = {
          'order_confirmed': 'order_confirmation',
          'order_preparing': 'order_processing', 
          'order_cancelled': 'order_cancellation',
          'pickup_ready': 'order_ready'
        };
        
        if (legacyMappings[email.template_key]) {
          normalizedTemplateKey = legacyMappings[email.template_key];
          console.log(`🔄 Normalized template key: ${email.template_key} → ${normalizedTemplateKey}`);
        }

        // Merge template_variables and variables for complete data
        const mergedVariables = {
          ...(email.template_variables || {}),
          ...(email.variables || {})
        };

        console.log(`📧 Sending with template: ${normalizedTemplateKey} (original: ${email.template_key})`);
        
        emailResult = await supabase.functions.invoke('unified-smtp-sender', {
          body: {
            to: email.recipient_email,
            subject: mergedVariables.subject || 'Notification from Starters Small Chops',
            htmlContent: mergedVariables.html_content,
            textContent: mergedVariables.text_content,
            templateKey: normalizedTemplateKey,
            variables: mergedVariables
          }
        })
      } catch (sendError) {
        console.error('Error calling unified-smtp-sender:', sendError)
        emailResult = { error: sendError }
      }

      if (emailResult.error || !emailResult.data?.success) {
        const errorMessage = emailResult.error?.message || emailResult.data?.error || 'Unknown sending error'
        console.log(`❌ Failed to send email ${email.id}: ${errorMessage}`)

        // Handle bounces and complaints by adding to suppression list
        if (errorMessage.toLowerCase().includes('bounce') || 
            errorMessage.toLowerCase().includes('rejected') || 
            errorMessage.toLowerCase().includes('invalid')) {
          
          await supabase
            .from('email_suppression_list')
            .upsert({
              email: email.recipient_email.toLowerCase(),
              suppression_type: 'bounce',
              reason: errorMessage,
              is_active: true,
              created_at: new Date().toISOString()
            })
          
          console.log(`📝 Added ${email.recipient_email} to suppression list`)
        }

        // Retry logic with exponential backoff
        const newRetryCount = (email.retry_count || 0) + 1
        const maxRetries = 3
        
        if (newRetryCount < maxRetries) {
          const backoffMinutes = Math.pow(2, newRetryCount) * 5 // 5, 10, 20 minutes
          const scheduledAt = new Date(Date.now() + backoffMinutes * 60000).toISOString()
          
          await supabase
            .from('communication_events')
            .update({
              status: 'queued',
              retry_count: newRetryCount,
              scheduled_at: scheduledAt,
              error_message: errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id)
            
          console.log(`🔄 Scheduled retry ${newRetryCount}/${maxRetries} for email ${email.id}`)
        } else {
          await supabase
            .from('communication_events')
            .update({
              status: 'failed',
              retry_count: newRetryCount,
              error_message: errorMessage,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id)
            
          console.log(`⏹️ Max retries reached for email ${email.id}, marking as failed`)
        }
        
        failed++
      } else {
        console.log(`✅ Successfully sent email ${email.id}`)

        await supabase
          .from('communication_events')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            provider_message_id: emailResult.data?.messageId
          })
          .eq('id', email.id)
        
        processed++
      }

    } catch (error) {
      console.error(`❌ Error processing email ${email.id}:`, error)
      
      await supabase
        .from('communication_events')
        .update({
          status: 'failed',
          error_message: error.message,
          retry_count: (email.retry_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)
      
      failed++
    }
  }

  // Log processing results
  await supabase
    .from('audit_logs')
    .insert({
      action: 'instant_email_processing_completed',
      category: 'Email Processing',
      message: `Instant email processing completed: ${processed} sent, ${failed} failed`,
      new_values: {
        processed,
        failed,
        priority,
        batch_size: emails.length,
        timestamp: new Date().toISOString()
      }
    })

  console.log(`📊 Processing complete: ${processed} sent, ${failed} failed`)

  return {
    success: true,
    processed,
    failed,
    message: `Processing completed: ${processed} sent, ${failed} failed`
  }
}