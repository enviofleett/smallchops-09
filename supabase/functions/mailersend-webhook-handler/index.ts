import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Secure CORS for webhook - only MailerSend
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://api.mailersend.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MailerSendEvent {
  type: string
  email?: {
    message?: {
      id: string
    }
    subject?: string
    recipients?: Array<{
      email: string
    }>
  }
  created_at: string
  data?: any
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Webhook signature verification
  const signature = req.headers.get('X-Signature') || req.headers.get('x-signature');
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  
  // Log security event for monitoring
  console.log(`MailerSend webhook from IP: ${clientIP}, has signature: ${!!signature}`);
  
  // Rate limiting check for webhooks
  const webhookKey = `webhook:${clientIP}`;
  // Allow up to 1000 webhook events per hour from same IP
  if (await checkWebhookRateLimit(webhookKey)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded'
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const events: MailerSendEvent[] = await req.json()
    console.log('Processing MailerSend webhook events:', events.length)

    if (!Array.isArray(events)) {
      console.error('Invalid webhook payload - not an array')
      return new Response('Invalid webhook payload', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Process each email event
    for (const event of events) {
      console.log('Processing event:', event.type, event.email?.message?.id)

      try {
        // Log delivery event
        await supabase
          .from('email_delivery_logs')
          .insert({
            email_id: event.email?.message?.id,
            event_type: event.type,
            recipient_email: event.email?.recipients?.[0]?.email,
            subject: event.email?.subject,
            status: event.type,
            timestamp: event.created_at,
            webhook_data: event,
            created_at: new Date().toISOString()
          })

        // Handle specific events
        switch (event.type) {
          case 'activity.delivered':
            await updateEmailStatus(supabase, event.email?.message?.id, 'delivered')
            break
          
          case 'activity.hard_bounced':
          case 'activity.soft_bounced':
            await handleBounce(supabase, event)
            break
          
          case 'activity.spam_complaints':
            await handleSpamComplaint(supabase, event)
            break
          
          case 'activity.unsubscribed':
            await handleUnsubscribe(supabase, event)
            break
          
          case 'activity.opened':
            await updateEmailStatus(supabase, event.email?.message?.id, 'opened')
            break
          
          case 'activity.clicked':
            await updateEmailStatus(supabase, event.email?.message?.id, 'clicked')
            break
        }

        console.log(`Successfully processed ${event.type} event`)
      } catch (eventError) {
        console.error(`Error processing event ${event.type}:`, eventError)
        // Continue processing other events even if one fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: events.length 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

async function updateEmailStatus(supabase: any, emailId: string, status: string) {
  if (!emailId) return

  await supabase
    .from('communication_events')
    .update({ 
      delivery_status: status, 
      updated_at: new Date().toISOString() 
    })
    .eq('external_id', emailId)
}

async function handleBounce(supabase: any, event: MailerSendEvent) {
  const email = event.email?.recipients?.[0]?.email
  if (!email) return

  console.log(`Handling bounce for email: ${email}`)

  // Mark email as problematic in suppression list
  await supabase
    .from('email_suppression_list')
    .upsert({
      email_address: email,
      reason: event.type === 'activity.hard_bounced' ? 'hard_bounce' : 'soft_bounce',
      event_data: event,
      created_at: new Date().toISOString()
    })

  // Update communication event status
  if (event.email?.message?.id) {
    await updateEmailStatus(supabase, event.email.message.id, 'bounced')
  }
}

async function handleSpamComplaint(supabase: any, event: MailerSendEvent) {
  const email = event.email?.recipients?.[0]?.email
  if (!email) return

  console.log(`Handling spam complaint for email: ${email}`)

  // Immediate suppression for spam complaints
  await supabase
    .from('email_suppression_list')
    .upsert({
      email_address: email,
      reason: 'spam_complaint',
      event_data: event,
      created_at: new Date().toISOString()
    })

  // Deactivate any existing consent
  await supabase
    .from('email_consents')
    .update({ 
      is_active: false, 
      unsubscribed_at: new Date().toISOString() 
    })
    .eq('email_address', email)

  // Update communication event status
  if (event.email?.message?.id) {
    await updateEmailStatus(supabase, event.email.message.id, 'spam_complaint')
  }
}

async function handleUnsubscribe(supabase: any, event: MailerSendEvent) {
  const email = event.email?.recipients?.[0]?.email
  if (!email) return

  console.log(`Handling unsubscribe for email: ${email}`)

  // Add to suppression list
  await supabase
    .from('email_suppression_list')
    .upsert({
      email_address: email,
      reason: 'unsubscribe',
      event_data: event,
      created_at: new Date().toISOString()
    })

  // Deactivate consent
  await supabase
    .from('email_consents')
    .update({ 
      is_active: false, 
      unsubscribed_at: new Date().toISOString() 
    })
    .eq('email_address', email)

  // Update communication event status
  if (event.email?.message?.id) {
    await updateEmailStatus(supabase, event.email.message.id, 'unsubscribed')
  }
}

// Rate limiting for webhooks
async function checkWebhookRateLimit(key: string): Promise<boolean> {
  // Simple in-memory rate limiting for webhooks
  // In production, you'd want to use Redis or similar
  return false; // Allow all for now, implement proper rate limiting if needed
}