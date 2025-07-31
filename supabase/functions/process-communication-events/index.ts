import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessingResult {
  processed: number
  failed: number
  errors: string[]
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

    console.log('Starting communication events processing...')

    // Get pending events (max 50 at a time to prevent timeout)
    const { data: events, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('Error fetching events:', fetchError)
      throw new Error(`Failed to fetch events: ${fetchError.message}`)
    }

    if (!events || events.length === 0) {
      console.log('No pending events to process')
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No pending events'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    console.log(`Found ${events.length} events to process`)

    const result: ProcessingResult = {
      processed: 0,
      failed: 0,
      errors: []
    }

    // Process events in batches of 10
    const batchSize = 10
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      
      await Promise.allSettled(
        batch.map(async (event) => {
          try {
            console.log(`Processing event ${event.id} of type ${event.event_type}`)

            // Mark as processing
            await supabase
              .from('communication_events')
              .update({ status: 'processing' })
              .eq('id', event.id)

            let success = false

            switch (event.event_type) {
              case 'order_status_update':
                success = await processOrderStatusUpdate(supabase, event)
                break
              case 'price_change':
                success = await processPriceChangeNotification(supabase, event)
                break
              case 'promotion_alert':
                success = await processPromotionAlert(supabase, event)
                break
              case 'welcome_email':
                success = await processWelcomeEmail(supabase, event)
                break
              default:
                console.log(`Unknown event type: ${event.event_type}`)
                success = false
            }

            if (success) {
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'sent',
                  processed_at: new Date().toISOString()
                })
                .eq('id', event.id)
              
              result.processed++
              console.log(`Successfully processed event ${event.id}`)
            } else {
              throw new Error('Processing failed')
            }

          } catch (error) {
            console.error(`Error processing event ${event.id}:`, error)
            
            // Update retry count and status
            const newRetryCount = (event.retry_count || 0) + 1
            const maxRetries = 3
            
            if (newRetryCount >= maxRetries) {
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'failed',
                  last_error: error.message,
                  retry_count: newRetryCount,
                  processed_at: new Date().toISOString()
                })
                .eq('id', event.id)
            } else {
              // Exponential backoff: retry after 2^retry_count minutes
              const retryDelay = Math.pow(2, newRetryCount) * 60 * 1000
              const retryAt = new Date(Date.now() + retryDelay).toISOString()
              
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'queued',
                  last_error: error.message,
                  retry_count: newRetryCount,
                  created_at: retryAt // Reschedule
                })
                .eq('id', event.id)
            }
            
            result.failed++
            result.errors.push(`Event ${event.id}: ${error.message}`)
          }
        })
      )

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < events.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`Processing complete. Processed: ${result.processed}, Failed: ${result.failed}`)

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('Communication events processing error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

async function processOrderStatusUpdate(supabase: any, event: any): Promise<boolean> {
  const { order_id, payload } = event
  
  if (!payload?.customer_email || !payload?.new_status) {
    console.error('Missing required fields for order status update')
    return false
  }

  // Determine template based on order status
  let templateId = ''
  switch (payload.new_status) {
    case 'confirmed':
      templateId = 'order_confirmation'
      break
    case 'preparing':
      templateId = 'order_preparing'
      break
    case 'ready':
      templateId = 'order_ready'
      break
    case 'completed':
      templateId = 'order_completed'
      break
    case 'cancelled':
      templateId = 'order_cancelled'
      break
    default:
      templateId = 'order_status_update'
  }

  const emailPayload = {
    templateId,
    recipient: {
      email: payload.customer_email,
      name: payload.customer_name || 'Valued Customer'
    },
    variables: {
      customerName: payload.customer_name || 'Valued Customer',
      orderNumber: payload.order_number || 'N/A',
      orderStatus: payload.new_status,
      orderTotal: payload.total_amount || '0',
      trackingUrl: `${await getSiteUrl(supabase)}/orders/${order_id}`
    },
    emailType: 'transactional'
  }

  const { error } = await supabase.functions.invoke('smtp-email-sender', {
    body: emailPayload
  })

  return !error
}

async function processPriceChangeNotification(supabase: any, event: any): Promise<boolean> {
  const { payload } = event
  
  if (!payload?.customer_email || !payload?.product_name) {
    console.error('Missing required fields for price change notification')
    return false
  }

  const emailPayload = {
    templateId: 'price_change_alert',
    recipient: {
      email: payload.customer_email,
      name: payload.customer_name || 'Valued Customer'
    },
    variables: {
      customerName: payload.customer_name || 'Valued Customer',
      productName: payload.product_name,
      oldPrice: payload.old_price || '0',
      newPrice: payload.new_price || '0',
      percentageChange: payload.percentage_change || '0',
      productUrl: `${await getSiteUrl(supabase)}/products/${payload.product_id}`
    },
    emailType: 'marketing'
  }

  const { error } = await supabase.functions.invoke('smtp-email-sender', {
    body: emailPayload
  })

  return !error
}

async function processPromotionAlert(supabase: any, event: any): Promise<boolean> {
  const { payload } = event
  
  if (!payload?.customer_email || !payload?.promotion_title) {
    console.error('Missing required fields for promotion alert')
    return false
  }

  const emailPayload = {
    templateId: 'promotion_alert',
    recipient: {
      email: payload.customer_email,
      name: payload.customer_name || 'Valued Customer'
    },
    variables: {
      customerName: payload.customer_name || 'Valued Customer',
      promotionTitle: payload.promotion_title,
      promotionDescription: payload.promotion_description || '',
      discountPercentage: payload.discount_percentage || '0',
      validUntil: payload.valid_until || '',
      shopUrl: `${await getSiteUrl(supabase)}/products`
    },
    emailType: 'marketing'
  }

  const { error } = await supabase.functions.invoke('smtp-email-sender', {
    body: emailPayload
  })

  return !error
}

async function processWelcomeEmail(supabase: any, event: any): Promise<boolean> {
  const { payload } = event
  
  if (!payload?.customer_email) {
    console.error('Missing required fields for welcome email')
    return false
  }

  const emailPayload = {
    templateId: 'welcome',
    recipient: {
      email: payload.customer_email,
      name: payload.customer_name || 'Valued Customer'
    },
    variables: {
      customerName: payload.customer_name || 'Valued Customer',
      welcomeMessage: 'Welcome to our platform!',
      shopUrl: `${await getSiteUrl(supabase)}/products`,
      supportEmail: await getSupportEmail(supabase)
    },
    emailType: 'transactional'
  }

  const { error } = await supabase.functions.invoke('smtp-email-sender', {
    body: emailPayload
  })

  return !error
}

// Helper function to get site URL dynamically
async function getSiteUrl(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('business_settings')
    .select('website_url')
    .limit(1)
    .maybeSingle()
  
  return Deno.env.get('SITE_URL') || data?.website_url || 'https://yourdomain.com'
}

// Helper function to get support email dynamically
async function getSupportEmail(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('business_settings')
    .select('email')
    .limit(1)
    .maybeSingle()
  
  return data?.email || 'support@yourdomain.com'
}