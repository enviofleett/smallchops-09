import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMSMessage {
  to: string
  message: string
  sender?: string
}

interface MySmstabResponse {
  status: string
  message: string
  data?: {
    message_id: string
    cost: number
    phone_number: string
    status: string
  }
  error?: string
}

interface ProcessingResult {
  processed: number
  failed: number
  errors: string[]
  cost: number
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

    console.log('Starting SMS processing...')

    // Get SMS credentials from function secrets
    const apiKey = Deno.env.get('MYSMSTAB_API_KEY')
    const senderId = Deno.env.get('MYSMSTAB_SENDER_ID') || 'Starters'
    const apiEndpoint = Deno.env.get('MYSMSTAB_API_ENDPOINT') || 'https://api.mysmstab.com/v1/sms/send'

    if (!apiKey) {
      throw new Error('MYSMSTAB_API_KEY not configured in function secrets')
    }

    // Get SMS provider settings
    const { data: providerSettings } = await supabase
      .from('sms_provider_settings')
      .select('*')
      .eq('provider_name', 'mysmstab')
      .eq('is_active', true)
      .single()

    if (!providerSettings) {
      throw new Error('SMS provider settings not found or inactive')
    }

    // Get pending SMS events (max 20 at a time for rate limiting)
    const { data: events, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .in('channel', ['sms', 'both'])
      .is('sms_status', null)
      .order('created_at', { ascending: true })
      .limit(20)

    if (fetchError) {
      console.error('Error fetching SMS events:', fetchError)
      throw new Error(`Failed to fetch SMS events: ${fetchError.message}`)
    }

    if (!events || events.length === 0) {
      console.log('No pending SMS events to process')
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No pending SMS events'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    console.log(`Found ${events.length} SMS events to process`)

    const result: ProcessingResult = {
      processed: 0,
      failed: 0,
      errors: [],
      cost: 0
    }

    // Process events one by one to respect rate limits
    for (const event of events) {
      try {
        console.log(`Processing SMS event ${event.id} of type ${event.event_type}`)

        // Check if phone number is suppressed
        if (event.recipient_phone) {
          const { data: suppressed } = await supabase
            .rpc('is_phone_suppressed', { phone_number: event.recipient_phone })

          if (suppressed) {
            console.log(`Phone number ${event.recipient_phone} is suppressed, skipping`)
            
            await supabase
              .from('communication_events')
              .update({ 
                sms_status: 'suppressed',
                sms_error_message: 'Phone number is in suppression list',
                processed_at: new Date().toISOString()
              })
              .eq('id', event.id)
            
            continue
          }
        }

        // Mark as processing
        await supabase
          .from('communication_events')
          .update({ sms_status: 'processing' })
          .eq('id', event.id)

        // Prepare SMS message content
        const messageContent = await prepareSMSContent(event, supabase)
        
        if (!messageContent || !event.recipient_phone) {
          throw new Error('Missing SMS content or recipient phone')
        }

        // Send SMS via mysmstab.com API
        const smsResult = await sendSMS({
          to: event.recipient_phone,
          message: messageContent,
          sender: senderId
        }, apiKey, apiEndpoint)

        if (smsResult.status === 'success' && smsResult.data) {
          // Success - update event and log delivery
          await supabase
            .from('communication_events')
            .update({
              sms_status: 'sent',
              sms_provider_message_id: smsResult.data.message_id,
              sms_provider_response: smsResult,
              sms_sent_at: new Date().toISOString(),
              processed_at: new Date().toISOString()
            })
            .eq('id', event.id)

          // Log delivery
          await supabase
            .from('sms_delivery_logs')
            .insert({
              communication_event_id: event.id,
              phone_number: event.recipient_phone,
              message_content: messageContent,
              provider_message_id: smsResult.data.message_id,
              status: 'sent',
              provider_response: smsResult,
              cost_amount: smsResult.data.cost,
              timestamp: new Date().toISOString()
            })

          result.processed++
          result.cost += smsResult.data.cost || 0
          console.log(`SMS sent successfully for event ${event.id}`)

        } else {
          throw new Error(smsResult.error || smsResult.message || 'SMS sending failed')
        }

      } catch (error) {
        console.error(`Error processing SMS event ${event.id}:`, error)
        
        // Update retry count and status
        const newRetryCount = (event.retry_count || 0) + 1
        const maxRetries = providerSettings.settings?.max_retries || 3
        
        if (newRetryCount >= maxRetries) {
          await supabase
            .from('communication_events')
            .update({ 
              sms_status: 'failed',
              sms_error_message: error.message,
              retry_count: newRetryCount,
              processed_at: new Date().toISOString()
            })
            .eq('id', event.id)
        } else {
          // Exponential backoff for retry
          const retryDelay = Math.pow(2, newRetryCount) * (providerSettings.settings?.retry_delay_seconds || 60) * 1000
          const retryAt = new Date(Date.now() + retryDelay).toISOString()
          
          await supabase
            .from('communication_events')
            .update({ 
              sms_status: 'queued',
              sms_error_message: error.message,
              retry_count: newRetryCount,
              created_at: retryAt // Reschedule
            })
            .eq('id', event.id)
        }
        
        result.failed++
        result.errors.push(`Event ${event.id}: ${error.message}`)
      }

      // Rate limiting delay between SMS sends
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`SMS processing complete. Processed: ${result.processed}, Failed: ${result.failed}, Cost: ${result.cost}`)

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('SMS processing error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

async function sendSMS(message: SMSMessage, apiKey: string, apiEndpoint: string): Promise<MySmstabResponse> {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: message.to,
        message: message.message,
        sender: message.sender || 'Starters',
        type: 'sms'
      })
    })

    const responseData = await response.json()

    if (!response.ok) {
      return {
        status: 'error',
        message: responseData.message || 'SMS API request failed',
        error: responseData.error || `HTTP ${response.status}`
      }
    }

    return responseData as MySmstabResponse
  } catch (error) {
    return {
      status: 'error',
      message: 'Network error',
      error: error.message
    }
  }
}

async function prepareSMSContent(event: any, supabase: any): Promise<string> {
  // Get SMS template based on event type
  const smsTemplates: Record<string, string> = {
    'order_status_sms': 'Hi {{customerName}}, your order {{orderNumber}} status: {{orderStatus}}. Track: {{trackingUrl}}',
    'payment_confirmation_sms': 'Hi {{customerName}}, payment confirmed for order {{orderNumber}}. Amount: {{orderTotal}}. Thanks!',
    'welcome_sms': 'Welcome {{customerName}}! Thanks for joining us. Start shopping: {{shopUrl}}',
    'order_ready_sms': 'Hi {{customerName}}, your order {{orderNumber}} is ready for pickup/delivery!',
    'order_completed_sms': 'Hi {{customerName}}, your order {{orderNumber}} has been completed. Thanks for choosing us!'
  }

  const templateKey = event.event_type
  let template = smsTemplates[templateKey]

  if (!template) {
    // Fallback to generic template
    template = 'Hi {{customerName}}, update on your order {{orderNumber}}. Status: {{orderStatus}}'
  }

  // Replace variables in template
  let content = template
  const variables = { ...event.variables, ...event.payload }

  // Replace all {{variable}} placeholders
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`
    content = content.replace(new RegExp(placeholder, 'g'), variables[key] || '')
  })

  // Ensure SMS length is within limits (160 characters for single SMS)
  if (content.length > 160) {
    content = content.substring(0, 157) + '...'
  }

  return content
}