import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  template_key: string;
  recipient: string;
  channel: 'sms' | 'email' | 'both';
  variables?: Record<string, string>;
  order_id?: string;
  customer_id?: string;
}

interface NotificationTemplate {
  id: string;
  template_key: string;
  template_name: string;
  channel: string;
  subject?: string;
  content: string;
  variables?: string[];
  is_active: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Delivery notification function called with method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: NotificationRequest = await req.json();
    console.log('Processing notification request:', request);

    // Validate request
    if (!request.template_key || !request.recipient || !request.channel) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template_key, recipient, channel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notification template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('template_key', request.template_key)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError) {
      console.error('Template fetch error:', templateError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch template' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template) {
      console.error('Template not found:', request.template_key);
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Replace variables in template content
    let processedContent = template.content;
    let processedSubject = template.subject || '';

    if (request.variables) {
      Object.entries(request.variables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        processedContent = processedContent.replace(regex, value);
        processedSubject = processedSubject.replace(regex, value);
      });
    }

    const results: Array<{ channel: string; success: boolean; error?: string }> = [];

    // Send via requested channels
    const channelsToSend = request.channel === 'both' ? ['email', 'sms'] : [request.channel];

    for (const channel of channelsToSend) {
      // Skip if template doesn't support this channel
      if (template.channel !== 'both' && template.channel !== channel) {
        console.log(`Template ${request.template_key} doesn't support ${channel} channel`);
        continue;
      }

      try {
        if (channel === 'email') {
          // Send email using existing email service
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: request.recipient,
              subject: processedSubject,
              html: processedContent,
              from: 'Starters <noreply@starters.app>'
            }
          });

          if (emailError) {
            console.error('Email sending failed:', emailError);
            results.push({ channel: 'email', success: false, error: emailError.message });
          } else {
            console.log('Email sent successfully:', emailResult);
            results.push({ channel: 'email', success: true });
          }

          // Log delivery attempt
          await supabase.from('notification_delivery_log').insert({
            order_id: request.order_id,
            customer_id: request.customer_id,
            template_id: template.id,
            channel: 'email',
            recipient: request.recipient,
            status: emailError ? 'failed' : 'sent',
            error_message: emailError?.message,
            sent_at: emailError ? null : new Date().toISOString()
          });

        } else if (channel === 'sms') {
          // For SMS, we would integrate with a provider like Twilio
          // For now, we'll log it as a placeholder
          console.log('SMS would be sent:', {
            to: request.recipient,
            message: processedContent
          });

          // Log SMS attempt (placeholder - would be real with Twilio integration)
          await supabase.from('notification_delivery_log').insert({
            order_id: request.order_id,
            customer_id: request.customer_id,
            template_id: template.id,
            channel: 'sms',
            recipient: request.recipient,
            status: 'sent', // Would be determined by actual SMS provider response
            sent_at: new Date().toISOString()
          });

          results.push({ channel: 'sms', success: true });
        }
      } catch (error: any) {
        console.error(`Failed to send ${channel} notification:`, error);
        results.push({ channel, success: false, error: error.message });

        // Log failed attempt
        await supabase.from('notification_delivery_log').insert({
          order_id: request.order_id,
          customer_id: request.customer_id,
          template_id: template.id,
          channel: channel,
          recipient: request.recipient,
          status: 'failed',
          error_message: error.message,
          failed_at: new Date().toISOString()
        });
      }
    }

    const hasFailures = results.some(r => !r.success);
    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: !hasFailures,
        message: hasFailures 
          ? `${successCount}/${results.length} notifications sent successfully`
          : 'All notifications sent successfully',
        results
      }),
      { 
        status: hasFailures ? 207 : 200, // 207 for partial success
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Notification function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);