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
  template_key?: string
  email_type: string
  status: string
  variables: Record<string, any>
  template_variables: Record<string, any>
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
    let rateLimitedCount = 0

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
      const batchResults = await Promise.allSettled(
        batch.map(async (event: CommunicationEvent) => {
          try {
            console.log(`Processing event ${event.id}: ${event.event_type}`)
            
            // Check rate limits before processing
            const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
              'check_email_rate_limit',
              {
                p_identifier: event.recipient_email,
                p_email_type: event.email_type || 'transactional'
              }
            )

            if (rateLimitError || !rateLimitResult) {
              console.warn(`Rate limit exceeded for ${event.recipient_email}`)
              await logProcessingEvent(supabase, event.id, 'rate_limited', 'Rate limit exceeded')
              
              // Mark as queued for later retry
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'queued',
                  error_message: 'Rate limit exceeded - will retry later'
                })
                .eq('id', event.id)
              
              rateLimitedCount++
              return false
            }
            
            let success = false
            
            // Route to appropriate handler
            switch (event.event_type) {
              case 'order_confirmation':
              case 'order_status_update':
              case 'payment_confirmation':
                success = await processOrderEmail(supabase, event)
                break
              case 'welcome_email':
              case 'customer_welcome':
                success = await processWelcomeEmail(supabase, event)
                break
              case 'password_reset':
                success = await processPasswordResetEmail(supabase, event)
                break
              case 'admin_notification':
                success = await processAdminNotification(supabase, event)
                break
              default:
                console.log(`Unknown event type: ${event.event_type}, treating as welcome email`)
                success = await processWelcomeEmail(supabase, event)
            }

            if (success) {
              // Mark as sent and create delivery confirmation
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'sent', 
                  sent_at: new Date().toISOString() 
                })
                .eq('id', event.id)
              
              // Create delivery confirmation tracking
              await createDeliveryConfirmation(supabase, event.id, event.recipient_email, 'sent')
              
              // Log successful processing for analytics
              await logProcessingEvent(supabase, event.id, 'sent', `Successfully processed ${event.event_type}`)
              
              processedCount++
              console.log(`Successfully processed event ${event.id}`)
              return true
            } else {
              // Handle failure
              await handleEventFailure(supabase, event)
              failedCount++
              return false
            }

          } catch (error) {
            console.error(`Error processing event ${event.id}:`, error)
            await handleEventFailure(supabase, event, error.message)
            failedCount++
            return false
          }
        })
      )
    }

    // Calculate daily metrics after processing
    try {
      await supabase.rpc('calculate_daily_email_metrics')
    } catch (error) {
      console.warn('Error calculating daily metrics:', error)
    }

    console.log(`Processing complete. Processed: ${processedCount}, Failed: ${failedCount}, Rate Limited: ${rateLimitedCount}`)

    return new Response(
      JSON.stringify({ 
        message: 'Communication events processed', 
        processed: processedCount,
        failed: failedCount,
        rate_limited: rateLimitedCount,
        total: events.length
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
    // Get business settings for dynamic URL resolution
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const siteUrl = businessSettings?.site_url || 
                   businessSettings?.website_url || 
                   'https://oknnklksdiqaifhxaccs.supabase.co'

    const enhancedVariables = {
      ...event.variables,
      siteUrl,
      companyName: businessSettings?.name || 'Starters'
    }

    // Invoke unified SMTP email sender
    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: {
        templateId: event.template_id || event.template_key || 'order_confirmation',
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
    console.log(`Processing welcome email for: ${event.recipient_email}`);

    // Call unified SMTP function with CORRECT format and fields
    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        // Correctly pass the `template_key` as `templateId`
        templateId: event.template_key,
        recipient: {
          email: event.recipient_email,
          // Correctly map the `customerName` from the variables
          name: event.template_variables?.customerName || 'Valued Customer',
        },
        // Correctly pass the `template_variables` object directly
        variables: event.template_variables,
        emailType: 'transactional',
      }
    });

    if (error) {
      console.error('SMTP function error:', error);
      return false;
    }

    console.log('Welcome email sent successfully:', data);
    return true;

  } catch (error) {
    console.error('Error processing welcome email:', error);
    return false;
  }
}

async function processPasswordResetEmail(supabase: any, event: CommunicationEvent): Promise<boolean> {
  try {
    // Get business settings for dynamic URL resolution
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const siteUrl = businessSettings?.site_url || 
                   businessSettings?.website_url || 
                   'https://oknnklksdiqaifhxaccs.supabase.co'

    const enhancedVariables = {
      ...event.variables,
      siteUrl,
      companyName: businessSettings?.name || 'Starters'
    }

    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        templateId: event.template_id || event.template_key || 'password_reset',
        recipient: {
          email: event.recipient_email,
          name: enhancedVariables?.customerName || 'User'
        },
        variables: enhancedVariables,
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

async function processAdminNotification(supabase: any, event: CommunicationEvent): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        templateId: event.template_id || event.template_key || 'admin_notification',
        recipient: {
          email: event.recipient_email,
          name: 'Admin'
        },
        variables: event.variables,
        emailType: 'transactional',
        priority: 'high'
      }
    })

    if (error) {
      console.error('SMTP function error for admin notification:', error)
      return false
    }

    console.log('Admin notification sent successfully:', data)
    return true

  } catch (error) {
    console.error('Error processing admin notification:', error)
    return false
  }
}

async function handleEventFailure(supabase: any, event: CommunicationEvent, errorMessage?: string): Promise<void> {
  const newRetryCount = event.retry_count + 1
  const maxRetries = 3

  // Log processing event for analytics
  await logProcessingEvent(supabase, event.id, 'failed', errorMessage || 'Unknown error')

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
    
    // Create delivery confirmation for failed email
    await createDeliveryConfirmation(supabase, event.id, event.recipient_email, 'failed', errorMessage)
    
    // Check if admin notification is needed
    await checkAdminNotification(supabase, event, errorMessage)
    
    console.log(`Event ${event.id} marked as permanently failed after ${maxRetries} attempts`)
  } else {
    // Schedule for retry with exponential backoff
    const retryDelay = Math.pow(2, newRetryCount) * 60 * 1000 // 2^retry * 60 seconds
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

// Helper function to create delivery confirmation tracking
async function createDeliveryConfirmation(
  supabase: any, 
  eventId: string, 
  recipientEmail: string, 
  status: string, 
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('email_delivery_confirmations')
      .insert({
        communication_event_id: eventId,
        recipient_email: recipientEmail,
        delivery_status: status,
        delivery_timestamp: new Date().toISOString(),
        error_message: errorMessage,
        provider_response: { 
          status, 
          timestamp: new Date().toISOString(),
          error: errorMessage 
        }
      })
  } catch (error) {
    console.error('Error creating delivery confirmation:', error)
  }
}

// Helper function to log processing events for analytics
async function logProcessingEvent(
  supabase: any, 
  eventId: string, 
  action: string, 
  details?: string
): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        action: `email_processing_${action}`,
        category: 'Email Processing',
        entity_type: 'communication_event',
        entity_id: eventId,
        message: `Email processing ${action}: ${details || 'No details'}`,
        new_values: { 
          action, 
          details, 
          timestamp: new Date().toISOString(),
          event_id: eventId 
        }
      })
  } catch (error) {
    console.error('Error logging processing event:', error)
  }
}

// Helper function to check if admin notification is needed
async function checkAdminNotification(
  supabase: any, 
  event: CommunicationEvent, 
  errorMessage?: string
): Promise<void> {
  try {
    // Get admin notification preferences
    const { data: preferences } = await supabase
      .from('admin_notification_preferences')
      .select('*')
      .eq('notification_type', 'email_failure')
      .eq('is_enabled', true)

    if (preferences && preferences.length > 0) {
      // Get business settings for admin email
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('admin_notification_email')
        .limit(1)
        .maybeSingle()

      const adminEmail = businessSettings?.admin_notification_email
      
      if (adminEmail) {
        // Queue admin notification
        await supabase
          .from('communication_events')
          .insert({
            event_type: 'admin_notification',
            recipient_email: adminEmail,
            template_key: 'email_failure_notification',
            email_type: 'transactional',
            status: 'queued',
            variables: {
              failedEventId: event.id,
              recipientEmail: event.recipient_email,
              eventType: event.event_type,
              errorMessage: errorMessage || 'Unknown error',
              timestamp: new Date().toISOString(),
              subject: `Email Delivery Failure - ${event.event_type}`
            }
          })
        
        console.log(`Admin notification queued for failed event ${event.id}`)
      }
    }
  } catch (error) {
    console.error('Error checking admin notification:', error)
  }
}