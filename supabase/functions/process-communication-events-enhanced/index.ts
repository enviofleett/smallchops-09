import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CommunicationEvent {
  id: string
  order_id?: string
  event_type: string
  recipient_email: string
  template_id?: string
  email_type: string
  status: string
  variables: Record<string, any>
  retry_count: number
  created_at: string
  error_message?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Starting enhanced communication events processing...')

    // Check if this is immediate processing for a specific event
    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const immediateProcessing = requestBody.immediate_processing;
    const specificEventId = requestBody.event_id;

    let events = [];
    
    if (immediateProcessing && specificEventId) {
      // Process specific event immediately
      const { data: specificEvent, error: specificError } = await supabase
        .from('communication_events')
        .select('*')
        .eq('id', specificEventId)
        .eq('status', 'queued')
        .single();
      
      if (specificEvent && !specificError) {
        events = [specificEvent];
        console.log(`Processing specific event immediately: ${specificEventId}`);
      }
    } else {
      // Fetch queued communication events (limit to 50 at a time)
      const { data: queuedEvents, error: fetchError } = await supabase
        .from('communication_events')
        .select('*')
        .eq('status', 'queued')
        .lt('retry_count', 3) // Only retry up to 3 times
        .order('created_at', { ascending: true })
        .limit(50)

      if (fetchError) {
        console.error('Error fetching communication events:', fetchError)
        throw fetchError
      }
      
      events = queuedEvents || [];
    }

    if (!events || events.length === 0) {
      console.log('No queued communication events found')
      return new Response(
        JSON.stringify({ message: 'No events to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${events.length} communication events to process`)

    let processedCount = 0
    let failedCount = 0

    // Process events in batches of 10
    const batchSize = 10
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      
      // Mark events as processing
      const eventIds = batch.map(event => event.id)
      await supabase
        .from('communication_events')
        .update({ status: 'processing', processed_at: new Date().toISOString() })
        .in('id', eventIds)

      // Process each event in the batch
      await Promise.allSettled(
        batch.map(async (event: CommunicationEvent) => {
          try {
            console.log(`Processing event ${event.id}: ${event.event_type}`)
            
            let success = false
            
            // Route to appropriate handler
            switch (event.event_type) {
              case 'order_confirmation':
              case 'order_status_update':
              case 'payment_confirmation':
                success = await processOrderEmail(supabase, event)
                break
              case 'customer_welcome':
                success = await processWelcomeEmail(supabase, event)
                break
              case 'password_reset':
                success = await processPasswordResetEmail(supabase, event)
                break
              default:
                console.log(`Unknown event type: ${event.event_type}`)
                success = false
            }

            if (success) {
              // Mark as sent
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'sent', 
                  sent_at: new Date().toISOString() 
                })
                .eq('id', event.id)
              
              processedCount++
              console.log(`Successfully processed event ${event.id}`)
            } else {
              // Handle failure
              await handleEventFailure(supabase, event)
              failedCount++
            }

          } catch (error) {
            console.error(`Error processing event ${event.id}:`, error)
            await handleEventFailure(supabase, event, error.message)
            failedCount++
          }
        })
      )
    }

    console.log(`Processing complete. Processed: ${processedCount}, Failed: ${failedCount}`)

    return new Response(
      JSON.stringify({ 
        message: 'Communication events processed', 
        processed: processedCount,
        failed: failedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in communication events processor:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function processOrderEmail(supabase: any, event: CommunicationEvent): Promise<boolean> {
  try {
    // Invoke SMTP email sender
    const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        templateId: event.template_id || event.template_key || 'welcome_customer',
        recipient: {
          email: event.recipient_email,
          name: event.variables?.customerName || 'Valued Customer'
        },
        variables: event.variables,
        emailType: event.email_type,
        priority: 'normal'
      }
    })

    if (error) {
      console.error('SMTP function error:', error)
      return false
    }

    console.log('Order email sent successfully:', data)
    return true

  } catch (error) {
    console.error('Error processing order email:', error)
    return false
  }
}

async function processWelcomeEmail(supabase: any, event: CommunicationEvent): Promise<boolean> {
  try {
    // Get business settings for welcome email customization
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    // Enhance variables with business info
    const enhancedVariables = {
      ...event.variables,
      supportEmail: businessSettings?.email || 'support@yourbusiness.com',
      websiteUrl: businessSettings?.website_url || window.location.origin
    }

    const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        templateId: event.template_id || event.template_key || 'welcome_customer',
        recipient: {
          email: event.recipient_email,
          name: enhancedVariables?.customerName || 'Valued Customer'
        },
        variables: enhancedVariables,
        emailType: event.email_type,
        priority: 'normal'
      }
    })

    if (error) {
      console.error('SMTP function error for welcome email:', error)
      return false
    }

    console.log('Welcome email sent successfully:', data)
    return true

  } catch (error) {
    console.error('Error processing welcome email:', error)
    return false
  }
}

async function processPasswordResetEmail(supabase: any, event: CommunicationEvent): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
      body: {
        templateId: event.template_id || event.template_key || 'password_reset',
        recipient: {
          email: event.recipient_email,
          name: event.variables?.customerName || 'User'
        },
        variables: event.variables,
        emailType: event.email_type,
        priority: 'high' // High priority for security emails
      }
    })

    if (error) {
      console.error('SMTP function error for password reset:', error)
      return false
    }

    console.log('Password reset email sent successfully:', data)
    return true

  } catch (error) {
    console.error('Error processing password reset email:', error)
    return false
  }
}

async function handleEventFailure(supabase: any, event: CommunicationEvent, errorMessage?: string): Promise<void> {
  const newRetryCount = event.retry_count + 1
  const maxRetries = 3

  if (newRetryCount >= maxRetries) {
    // Mark as failed permanently
    await supabase
      .from('communication_events')
      .update({ 
        status: 'failed',
        retry_count: newRetryCount,
        error_message: errorMessage || 'Max retries exceeded',
        last_error: errorMessage || 'Unknown error'
      })
      .eq('id', event.id)
    
    console.log(`Event ${event.id} marked as permanently failed after ${maxRetries} attempts`)
  } else {
    // Schedule for retry
    const retryDelay = Math.pow(2, newRetryCount) * 60 * 1000 // Exponential backoff: 2^retry * 60 seconds
    const nextRetryAt = new Date(Date.now() + retryDelay).toISOString()
    
    await supabase
      .from('communication_events')
      .update({ 
        status: 'queued',
        retry_count: newRetryCount,
        error_message: errorMessage || 'Retry scheduled',
        processed_at: nextRetryAt
      })
      .eq('id', event.id)
    
    console.log(`Event ${event.id} scheduled for retry ${newRetryCount}/${maxRetries} at ${nextRetryAt}`)
  }
}