import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Production-ready CORS configuration for MailerSend webhooks
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  // Only allow MailerSend webhook origins
  const allowedOrigins = [
    'https://webhook.mailersend.com',
    'https://api.mailersend.com'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : 'https://api.mailersend.com';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'content-type, signature',
    'Access-Control-Allow-Methods': 'POST',
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
};

interface MailerSendEvent {
  type: string;
  timestamp: number;
  email: {
    message?: {
      id: string;
    };
    recipient?: {
      email: string;
    };
    subject?: string;
  };
  activity?: {
    category?: string;
    type?: string;
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

async function logSecurityIncident(type: string, description: string, severity: string, metadata: any = {}) {
  try {
    await supabase.from('security_incidents').insert({
      type,
      description,
      severity,
      request_data: metadata,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security incident:', error);
  }
}

async function checkWebhookRateLimit(clientIP: string): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - 60000); // 1 minute window
    
    const { data, error } = await supabase
      .from('api_rate_limits')
      .select('request_count')
      .eq('identifier', clientIP)
      .eq('endpoint', 'mailersend_webhook')
      .gte('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return true; // Allow on error
    }

    if (data && data.request_count >= 60) { // Max 60 requests per minute
      return false;
    }

    // Update or insert rate limit record
    await supabase
      .from('api_rate_limits')
      .upsert({
        identifier: clientIP,
        endpoint: 'mailersend_webhook',
        request_count: (data?.request_count || 0) + 1,
        window_start: windowStart.toISOString()
      }, { onConflict: 'identifier,endpoint,window_start' });

    return true;
  } catch (err) {
    console.error('Rate limiting error:', err);
    return true; // Allow on error
  }
}

async function updateEmailStatus(emailId: string, status: string): Promise<void> {
  try {
    await supabase
      .from('communication_events')
      .update({
        delivery_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', emailId);
  } catch (error) {
    console.error('Failed to update email status:', error);
  }
}

async function handleBounce(event: MailerSendEvent): Promise<void> {
  const email = event.email?.recipient?.email;
  if (!email) return;

  try {
    // Add to suppression list
    await supabase.from('email_suppression_list').insert({
      email_address: email,
      reason: event.activity?.type === 'hard_bounced' ? 'hard_bounce' : 'soft_bounce',
      event_data: event,
      created_at: new Date().toISOString()
    });

    // Update communication event status
    if (event.email?.message?.id) {
      await updateEmailStatus(event.email.message.id, 'bounced');
    }
  } catch (error) {
    console.error('Failed to handle bounce:', error);
  }
}

async function handleSpamComplaint(event: MailerSendEvent): Promise<void> {
  const email = event.email?.recipient?.email;
  if (!email) return;

  try {
    // Add to suppression list
    await supabase.from('email_suppression_list').insert({
      email_address: email,
      reason: 'spam_complaint',
      event_data: event,
      created_at: new Date().toISOString()
    });

    // Deactivate email consent
    await supabase
      .from('email_consents')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email_address', email);

    // Update communication event status
    if (event.email?.message?.id) {
      await updateEmailStatus(event.email.message.id, 'spam_complaint');
    }
  } catch (error) {
    console.error('Failed to handle spam complaint:', error);
  }
}

async function handleUnsubscribe(event: MailerSendEvent): Promise<void> {
  const email = event.email?.recipient?.email;
  if (!email) return;

  try {
    // Add to suppression list
    await supabase.from('email_suppression_list').insert({
      email_address: email,
      reason: 'unsubscribe',
      event_data: event,
      created_at: new Date().toISOString()
    });

    // Deactivate email consent
    await supabase
      .from('email_consents')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email_address', email);

    // Update communication event status
    if (event.email?.message?.id) {
      await updateEmailStatus(event.email.message.id, 'unsubscribed');
    }
  } catch (error) {
    console.error('Failed to handle unsubscribe:', error);
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    console.log('[MAILERSEND-WEBHOOK] Processing webhook request...');
    
    // Get client IP for security logging and rate limiting
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    req.headers.get('x-real-ip') || 
                    'unknown';

    // Rate limiting check
    const rateLimitPassed = await checkWebhookRateLimit(clientIP);
    if (!rateLimitPassed) {
      await logSecurityIncident(
        'webhook_rate_limit_exceeded',
        `MailerSend webhook rate limit exceeded from IP: ${clientIP}`,
        'medium',
        { ip: clientIP, user_agent: req.headers.get('user-agent') }
      );

      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // Parse webhook payload
    let events: MailerSendEvent[];
    try {
      const body = await req.text();
      events = JSON.parse(body);
      
      if (!Array.isArray(events)) {
        events = [events];
      }
    } catch (error) {
      console.error('[MAILERSEND-WEBHOOK] Invalid JSON payload:', error);
      return new Response('Invalid JSON payload', { status: 400, headers: corsHeaders });
    }

    console.log(`[MAILERSEND-WEBHOOK] Processing ${events.length} events`);

    // Process each event with enhanced error handling
    for (const event of events) {
      try {
        // Log the event for audit
        await supabase.from('email_delivery_logs').insert({
          event_type: event.type,
          recipient_email: event.email?.recipient?.email || 'unknown',
          subject: event.email?.subject || 'unknown',
          status: event.type,
          email_id: event.email?.message?.id,
          timestamp: new Date(event.timestamp * 1000).toISOString(),
          webhook_data: event,
          created_at: new Date().toISOString()
        });

        // Handle specific event types
        switch (event.type) {
          case 'activity.delivered':
            if (event.email?.message?.id) {
              await updateEmailStatus(event.email.message.id, 'delivered');
            }
            break;

          case 'activity.hard_bounced':
          case 'activity.soft_bounced':
            await handleBounce(event);
            break;

          case 'activity.spam_complaints':
            await handleSpamComplaint(event);
            break;

          case 'activity.unsubscribed':
            await handleUnsubscribe(event);
            break;

          case 'activity.opened':
            if (event.email?.message?.id) {
              await updateEmailStatus(event.email.message.id, 'opened');
            }
            break;

          case 'activity.clicked':
            if (event.email?.message?.id) {
              await updateEmailStatus(event.email.message.id, 'clicked');
            }
            break;

          default:
            console.log(`[MAILERSEND-WEBHOOK] Unhandled event type: ${event.type}`);
        }

      } catch (eventError) {
        console.error(`[MAILERSEND-WEBHOOK] Error processing event ${event.type}:`, eventError);
        
        await logSecurityIncident(
          'webhook_processing_error',
          'Failed to process MailerSend webhook event',
          'medium',
          {
            event_type: event.type,
            email_id: event.email?.message?.id,
            error: eventError.message
          }
        );
      }
    }

    console.log('[MAILERSEND-WEBHOOK] Successfully processed all events');
    return new Response(
      JSON.stringify({ success: true, processed: events.length }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MAILERSEND-WEBHOOK] Webhook handler error:', error);
    
    await logSecurityIncident(
      'webhook_handler_error',
      'Critical error in MailerSend webhook handler',
      'high',
      { error: error.message }
    );

    return new Response(
      JSON.stringify({ success: false, error: 'Webhook processing failed' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});