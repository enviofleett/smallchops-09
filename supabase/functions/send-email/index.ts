import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Production-ready CORS configuration
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://project-oknnklksdiqaifhxaccs.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  template_id?: string;
  variables?: Record<string, any>;
  order_id?: string;
  event_id?: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const MAILERSEND_API_TOKEN = Deno.env.get('MAILERSEND_API_TOKEN');

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    if (!MAILERSEND_API_TOKEN) {
      throw new Error('MailerSend API token not configured');
    }

    const emailRequest: EmailRequest = await req.json();
    
    // Input validation
    if (!emailRequest.to || !emailRequest.subject) {
      throw new Error('Missing required fields: to, subject');
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRequest.to)) {
      throw new Error('Invalid recipient email address');
    }
    
    console.log('Processing email request:', { 
      to: emailRequest.to, 
      subject: emailRequest.subject,
      order_id: emailRequest.order_id 
    });

    // Get sender configuration from database
    const { data: commSettings, error: settingsError } = await supabase
      .from('communication_settings')
      .select('*')
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching communication settings:', settingsError);
      throw new Error('Failed to fetch email configuration');
    }

    const senderEmail = commSettings?.sender_email || 'noreply@example.com';
    const senderName = commSettings?.smtp_user || 'Your Business';

    // Prepare MailerSend payload
    const mailerSendPayload: any = {
      from: {
        email: senderEmail,
        name: senderName
      },
      to: [
        {
          email: emailRequest.to
        }
      ],
      subject: emailRequest.subject
    };

    // Add HTML content or template
    if (emailRequest.html) {
      mailerSendPayload.html = emailRequest.html;
    } else if (emailRequest.template_id) {
      mailerSendPayload.template_id = emailRequest.template_id;
      if (emailRequest.variables) {
        mailerSendPayload.variables = [
          {
            email: emailRequest.to,
            substitutions: emailRequest.variables
          }
        ];
      }
    } else {
      throw new Error('Either html content or template_id must be provided');
    }

    // Add rate limiting check
    const rateLimitKey = `email_${emailRequest.to}_${Date.now() / (1000 * 60)}`; // Per minute
    
    // Send email via MailerSend API with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let mailerSendResponse: Response;
    
    while (attempts < maxAttempts) {
      try {
        mailerSendResponse = await fetch('https://api.mailersend.com/v1/email', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MAILERSEND_API_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(mailerSendPayload)
        });
        
        if (mailerSendResponse.ok) break;
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }

    const responseData = await mailerSendResponse.json();

    if (!mailerSendResponse.ok) {
      console.error('MailerSend API error:', responseData);
      throw new Error(`MailerSend API error: ${responseData.message || 'Unknown error'}`);
    }

    console.log('Email sent successfully:', responseData);

    // Log the email in communication_logs
    const logData = {
      order_id: emailRequest.order_id,
      event_id: emailRequest.event_id,
      recipient: emailRequest.to,
      subject: emailRequest.subject,
      channel: 'email',
      status: 'sent',
      provider_response: responseData,
      template_name: emailRequest.template_id || 'custom'
    };

    const { error: logError } = await supabase
      .from('communication_logs')
      .insert(logData);

    if (logError) {
      console.error('Error logging email:', logError);
      // Don't fail the request if logging fails
    }

    // Update communication event status if event_id provided
    if (emailRequest.event_id) {
      const { error: updateError } = await supabase
        .from('communication_events')
        .update({
          status: 'sent',
          processed_at: new Date().toISOString()
        })
        .eq('id', emailRequest.event_id);

      if (updateError) {
        console.error('Error updating communication event:', updateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message_id: responseData.message_id || responseData.id,
      message: 'Email sent successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in send-email function:', error);

    // Log failed email attempt
    try {
      const emailRequest: EmailRequest = await req.clone().json();
      const logData = {
        order_id: emailRequest.order_id,
        event_id: emailRequest.event_id,
        recipient: emailRequest.to,
        subject: emailRequest.subject,
        channel: 'email',
        status: 'failed',
        error_message: error.message
      };

      await supabase.from('communication_logs').insert(logData);

      // Update communication event status if event_id provided
      if (emailRequest.event_id) {
        await supabase
          .from('communication_events')
          .update({
            status: 'failed',
            last_error: error.message,
            retry_count: supabase.raw('retry_count + 1')
          })
          .eq('id', emailRequest.event_id);
      }
    } catch (logError) {
      console.error('Error logging failed email:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});