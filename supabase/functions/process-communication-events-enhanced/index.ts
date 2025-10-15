import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface CommunicationEvent {
  id: string;
  order_id?: string;
  event_type: string;
  recipient_email: string;
  template_key?: string;
  email_type: string;
  status: string;
  variables: Record<string, any>;
  template_variables: Record<string, any>;
  retry_count: number;
  created_at: string;
  error_message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { health_check, immediate_processing, event_id, batchSize = 20 } = body;

    // Handle health check
    if (health_check) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'healthy',
          service: 'process-communication-events-enhanced'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔄 Processing communication events enhanced...');
    
    // Build query for queued events - filter out NULL template_key to prevent spam
    let query = supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .not('template_key', 'is', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    // If processing specific event
    if (event_id) {
      query = supabase
        .from('communication_events')
        .select('*')
        .eq('id', event_id);
    }

    const { data: events, error: fetchError } = await query;

    if (fetchError) {
      console.error('Failed to fetch communication events:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch events',
          details: fetchError.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0,
          message: 'No events to process'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let processed = 0;
    let failed = 0;
    const results = [];

    // Process each event
    for (const event of events) {
      try {
        console.log(`Processing event ${event.id}: ${event.event_type} to ${event.recipient_email}`);

        // Mark as processing
        await supabase
          .from('communication_events')
          .update({ status: 'processing' })
          .eq('id', event.id);

        // Send via unified SMTP sender
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('unified-smtp-sender', {
          body: {
            to: event.recipient_email,
            template_key: event.template_key || getTemplateKeyFromEventType(event.event_type),
            variables: {
              ...event.variables,
              ...event.template_variables
            },
            email_type: event.email_type || 'transactional'
          }
        });

        if (emailError || !emailResult?.success) {
          throw new Error(emailError?.message || emailResult?.error || 'Email sending failed');
        }

        // Mark as sent
        await supabase
          .from('communication_events')
          .update({ 
            status: 'sent',
            processed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', event.id);

        processed++;
        results.push({ id: event.id, status: 'sent' });

      } catch (error: any) {
        console.error(`Failed to process event ${event.id}:`, error);
        
        // Update retry count and status
        const newRetryCount = (event.retry_count || 0) + 1;
        const shouldRetry = newRetryCount < 3;

        await supabase
          .from('communication_events')
          .update({ 
            status: shouldRetry ? 'queued' : 'failed',
            retry_count: newRetryCount,
            error_message: error.message,
            last_retry_at: new Date().toISOString()
          })
          .eq('id', event.id);

        failed++;
        results.push({ 
          id: event.id, 
          status: shouldRetry ? 'retry_queued' : 'failed', 
          error: error.message,
          retry_count: newRetryCount
        });
      }
    }

    console.log(`✅ Enhanced processing complete: ${processed} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        failed,
        total: events.length,
        results: immediate_processing ? results : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Enhanced communication processor error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Processing failed' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

// Helper function to get template key from event type
function getTemplateKeyFromEventType(eventType: string): string {
  const mapping: Record<string, string> = {
    'customer_welcome': 'customer_welcome',
    'order_confirmation': 'order_confirmation', 
    'payment_confirmation': 'payment_confirmation',
    'order_status_update': 'order_confirmed',
    'admin_notification': 'admin_new_order',
    'password_reset': 'password_reset'
  };
  
  return mapping[eventType] || 'default_notification';
}

serve(handler);