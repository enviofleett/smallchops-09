import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Production-ready CORS configuration
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovableproject.com'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('=== Instant Welcome Email Processor Started ===')

    // Get all queued welcome emails for immediate processing
    const { data: queuedWelcomeEmails, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .eq('event_type', 'customer_welcome')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50) // Process max 50 at once for production stability

    if (fetchError) {
      console.error('Error fetching queued welcome emails:', fetchError)
      throw fetchError
    }

    if (!queuedWelcomeEmails || queuedWelcomeEmails.length === 0) {
      console.log('✅ No queued welcome emails found')
      return new Response(
        JSON.stringify({ 
          message: 'No queued welcome emails to process', 
          processed: 0,
          status: 'success'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📧 Found ${queuedWelcomeEmails.length} queued welcome emails to process instantly`)

    let successCount = 0
    let failureCount = 0
    const results = []

    // Process each welcome email immediately
    for (const event of queuedWelcomeEmails) {
      try {
        console.log(`🔄 Processing welcome email ${event.id} for ${event.recipient_email}`)
        
        // Mark as processing to prevent duplicate processing
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id)

        // Call SMTP email sender directly with template
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('smtp-email-sender', {
          headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
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
              authProvider: event.variables?.authProvider || 'email'
            },
            emailType: 'transactional'
          }
        })

        if (emailError) {
          console.error(`❌ Failed to send welcome email ${event.id}:`, emailError)
          
          // Update status to failed with retry logic
          await supabase
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: emailError.message,
              last_error: emailError.message,
              retry_count: (event.retry_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', event.id)

          failureCount++
          results.push({
            eventId: event.id,
            recipient: event.recipient_email,
            status: 'failed',
            error: emailError.message
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

        // Log successful delivery
        console.log(`✅ Welcome email sent successfully: ${event.id} -> ${event.recipient_email}`)
        
        successCount++
        results.push({
          eventId: event.id,
          recipient: event.recipient_email,
          status: 'sent',
          messageId: emailResult?.messageId
        })

        // Production rate limiting - small delay between emails
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (eventError) {
        console.error(`❌ Error processing welcome email ${event.id}:`, eventError)
        
        // Update with error
        await supabase
          .from('communication_events')
          .update({ 
            status: 'failed',
            error_message: eventError.message,
            last_error: eventError.message,
            retry_count: (event.retry_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id)

        failureCount++
        results.push({
          eventId: event.id,
          recipient: event.recipient_email,
          status: 'error',
          error: eventError.message
        })
      }
    }

    // Log comprehensive results
    console.log(`=== Welcome Email Processing Complete ===`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failureCount}`)

    // Log to audit for monitoring
    await supabase.from('audit_logs').insert({
      action: 'instant_welcome_processing',
      category: 'Email Processing',
      message: `Processed ${queuedWelcomeEmails.length} welcome emails: ${successCount} sent, ${failureCount} failed`,
      new_values: {
        total_processed: queuedWelcomeEmails.length,
        successful: successCount,
        failed: failureCount,
        processing_time: new Date().toISOString(),
        production_mode: true
      }
    })

    // Production monitoring - alert if failure rate is high
    const failureRate = failureCount / queuedWelcomeEmails.length
    if (failureRate > 0.2 && queuedWelcomeEmails.length > 5) {
      console.warn(`⚠️ HIGH FAILURE RATE: ${(failureRate * 100).toFixed(1)}% of welcome emails failed`)
      
      // Log critical alert
      await supabase.from('audit_logs').insert({
        action: 'welcome_email_high_failure_rate',
        category: 'System Alert',
        message: `Critical: Welcome email failure rate is ${(failureRate * 100).toFixed(1)}%`,
        new_values: {
          failure_rate: failureRate,
          total_processed: queuedWelcomeEmails.length,
          failed_count: failureCount,
          alert_level: 'critical'
        }
      })
    }

    return new Response(
      JSON.stringify({ 
        message: 'Welcome email processing completed',
        total_events: queuedWelcomeEmails.length,
        successful: successCount,
        failed: failureCount,
        failure_rate: failureRate,
        status: 'completed',
        production_ready: true,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== Instant Welcome Processor Error ===')
    console.error('Error:', error.message)
    
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
    )
  }
})