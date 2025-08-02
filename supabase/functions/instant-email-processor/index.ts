// Real-time Email Processing Engine
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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

    if (!highPriorityEmails || highPriorityEmails.length === 0) {
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

      if (!normalEmails || normalEmails.length === 0) {
        return new Response(
          JSON.stringify({ 
            message: 'No queued emails to process', 
            processed: 0,
            status: 'success'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Process normal priority emails
      const result = await processEmails(supabase, normalEmails, 'normal')
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📧 Found ${highPriorityEmails.length} high priority emails to process`)

    // Process high priority emails
    const result = await processEmails(supabase, highPriorityEmails, 'high')

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== Instant Email Processor Error ===')
    console.error('Error:', error.message)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function processEmails(supabase: any, emails: any[], priority: string) {
  let successCount = 0
  let failureCount = 0
  const results = []

  for (const event of emails) {
    try {
      console.log(`🔄 Processing ${priority} priority email ${event.id} for ${event.recipient_email}`)
      
      // Mark as processing
      await supabase
        .from('communication_events')
        .update({ 
          status: 'processing',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id)

      // Determine which email sender to use
      const emailSender = priority === 'high' ? 'enhanced-smtp-sender' : 'smtp-email-sender'
      
      // Call email sender with enhanced error handling
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(emailSender, {
        body: {
          templateId: event.template_key || 'welcome_customer',
          recipient: {
            email: event.recipient_email,
            name: event.variables?.customerName || 'Valued Customer'
          },
          variables: {
            ...event.variables,
            companyName: 'Starters',
            supportEmail: 'support@starters.com',
            websiteUrl: 'https://starters.com',
            isWelcomeEmail: true,
            priority: priority,
            processingTime: new Date().toISOString()
          },
          emailType: 'transactional'
        }
      })

      if (emailError) {
        console.error(`❌ Failed to send ${priority} priority email ${event.id}:`, emailError)
        
        // Update status to failed with intelligent retry logic
        const newRetryCount = (event.retry_count || 0) + 1
        const shouldRetry = newRetryCount < 3
        
        await supabase
          .from('communication_events')
          .update({ 
            status: shouldRetry ? 'queued' : 'failed',
            error_message: emailError.message,
            last_error: emailError.message,
            retry_count: newRetryCount,
            updated_at: new Date().toISOString(),
            // Exponential backoff for retries
            created_at: shouldRetry ? 
              new Date(Date.now() + (Math.pow(2, newRetryCount) * 60000)).toISOString() :
              event.created_at
          })
          .eq('id', event.id)

        failureCount++
        results.push({
          eventId: event.id,
          recipient: event.recipient_email,
          priority: priority,
          status: shouldRetry ? 'retry_scheduled' : 'failed',
          error: emailError.message,
          retryCount: newRetryCount
        })
        
        continue
      }

      // Update status to sent on success
      await supabase
        .from('communication_events')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString(),
          external_id: emailResult?.messageId,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id)

      console.log(`✅ ${priority} priority email sent successfully: ${event.id} -> ${event.recipient_email}`)
      
      successCount++
      results.push({
        eventId: event.id,
        recipient: event.recipient_email,
        priority: priority,
        status: 'sent',
        messageId: emailResult?.messageId,
        method: emailResult?.method || 'smtp'
      })

      // Small delay between emails to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (eventError) {
      console.error(`❌ Error processing ${priority} priority email ${event.id}:`, eventError)
      
      // Update with error
      const newRetryCount = (event.retry_count || 0) + 1
      await supabase
        .from('communication_events')
        .update({ 
          status: newRetryCount >= 3 ? 'failed' : 'queued',
          error_message: eventError.message,
          last_error: eventError.message,
          retry_count: newRetryCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id)

      failureCount++
      results.push({
        eventId: event.id,
        recipient: event.recipient_email,
        priority: priority,
        status: 'error',
        error: eventError.message,
        retryCount: newRetryCount
      })
    }
  }

  // Log comprehensive results
  console.log(`=== ${priority.toUpperCase()} Priority Email Processing Complete ===`)
  console.log(`✅ Successful: ${successCount}`)
  console.log(`❌ Failed: ${failureCount}`)

  // Log to audit for monitoring
  await supabase.from('audit_logs').insert({
    action: 'instant_email_processing',
    category: 'Email Processing',
    message: `Processed ${emails.length} ${priority} priority emails: ${successCount} sent, ${failureCount} failed`,
    new_values: {
      total_processed: emails.length,
      successful: successCount,
      failed: failureCount,
      priority: priority,
      processing_time: new Date().toISOString()
    }
  })

  return {
    message: `${priority} priority email processing completed`,
    total_events: emails.length,
    successful: successCount,
    failed: failureCount,
    failure_rate: failureCount / emails.length,
    priority: priority,
    status: 'completed',
    results: results
  }
}