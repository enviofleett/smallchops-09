import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMSTemplate {
  id: string
  name: string
  content: string
  variables: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting SMS processing...')

    // Get queued SMS communication events
    const { data: events, error: eventsError } = await supabaseClient
      .from('communication_events')
      .select(`
        id,
        order_id,
        event_type,
        sms_phone,
        template_key,
        variables,
        sms_sender,
        retry_count,
        created_at
      `)
      .eq('channel', 'sms')
      .eq('status', 'queued')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50)

    if (eventsError) {
      throw new Error(`Failed to fetch SMS events: ${eventsError.message}`)
    }

    if (!events || events.length === 0) {
      console.log('No SMS events to process')
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No SMS events to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${events.length} SMS events to process`)

    let processedCount = 0
    let failedCount = 0

    for (const event of events) {
      try {
        // Update status to processing
        await supabaseClient
          .from('communication_events')
          .update({ 
            status: 'processing',
            processing_started_at: new Date().toISOString()
          })
          .eq('id', event.id)

        // Check if phone number is suppressed
        const { data: isSuppressed } = await supabaseClient
          .rpc('is_phone_suppressed', { phone_text: event.sms_phone })

        if (isSuppressed) {
          console.log(`Phone ${event.sms_phone} is suppressed, skipping`)
          await supabaseClient
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: 'Phone number is in suppression list',
              processed_at: new Date().toISOString()
            })
            .eq('id', event.id)
          continue
        }

        // Get SMS template
        const { data: template, error: templateError } = await supabaseClient
          .from('sms_templates')
          .select('id, name, content, variables')
          .eq('template_key', event.template_key)
          .eq('is_active', true)
          .single()

        if (templateError || !template) {
          console.error(`SMS template not found: ${event.template_key}`)
          await supabaseClient
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: `SMS template not found: ${event.template_key}`,
              processed_at: new Date().toISOString()
            })
            .eq('id', event.id)
          continue
        }

        // Process template variables
        let message = template.content
        if (event.variables && typeof event.variables === 'object') {
          for (const [key, value] of Object.entries(event.variables)) {
            const placeholder = `{{${key}}}`
            message = message.replace(new RegExp(placeholder, 'g'), String(value))
          }
        }

        // Send SMS via MySMSTab
        const smsResponse = await supabaseClient.functions.invoke('mysmstab-sms', {
          body: {
            phoneNumber: event.sms_phone,
            message: message,
            sender: event.sms_sender || 'MySMSTab'
          }
        })

        if (smsResponse.error) {
          throw new Error(`SMS sending failed: ${smsResponse.error}`)
        }

        // Update event as sent
        await supabaseClient
          .from('communication_events')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            delivery_status: 'delivered'
          })
          .eq('id', event.id)

        processedCount++
        console.log(`SMS sent successfully for event ${event.id}`)

      } catch (error) {
        console.error(`Failed to process SMS event ${event.id}:`, error)
        
        // Update retry count and status
        await supabaseClient
          .from('communication_events')
          .update({ 
            status: 'failed',
            error_message: error.message,
            retry_count: (event.retry_count || 0) + 1,
            processed_at: new Date().toISOString()
          })
          .eq('id', event.id)

        failedCount++
      }
    }

    console.log(`SMS processing complete: ${processedCount} sent, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount,
        message: `Processed ${processedCount} SMS messages successfully, ${failedCount} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('SMS processor error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})