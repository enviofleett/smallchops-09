import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  recipient: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateKey?: string;
  variables?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  delayUntil?: string;
}

interface EmailResponse {
  success: boolean;
  emailId?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'send_email':
        return await handleSendEmail(supabaseClient, payload as EmailRequest);
      case 'process_queue':
        return await handleProcessQueue(supabaseClient);
      case 'check_health':
        return await handleHealthCheck(supabaseClient);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Email core error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleSendEmail(
  supabase: any, 
  emailRequest: EmailRequest
): Promise<Response> {
  try {
    // Validate input
    if (!emailRequest.recipient || !emailRequest.subject) {
      throw new Error('Recipient and subject are required');
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(supabase, emailRequest.recipient);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
    }

    // Check suppression list
    const isSupprressed = await checkSuppressionList(supabase, emailRequest.recipient);
    if (isSupprressed) {
      throw new Error('Email address is suppressed');
    }

    // Queue email for processing
    const { data: emailEvent, error } = await supabase
      .from('communication_events')
      .insert({
        recipient_email: emailRequest.recipient,
        event_type: 'email',
        template_key: emailRequest.templateKey,
        variables: emailRequest.variables || {},
        priority: emailRequest.priority || 'normal',
        scheduled_at: emailRequest.delayUntil ? new Date(emailRequest.delayUntil) : new Date(),
        status: 'queued',
        payload: {
          subject: emailRequest.subject,
          htmlContent: emailRequest.htmlContent,
          textContent: emailRequest.textContent
        }
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to queue email: ${error.message}`);
    }

    const response: EmailResponse = {
      success: true,
      emailId: emailEvent.id
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send email error:', error);
    const response: EmailResponse = {
      success: false,
      error: error.message
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleProcessQueue(supabase: any): Promise<Response> {
  try {
    // Get pending emails
    const { data: pendingEmails, error } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .lte('scheduled_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch pending emails: ${error.message}`);
    }

    const processedCount = pendingEmails?.length || 0;
    const results = [];

    for (const email of pendingEmails || []) {
      try {
        // Mark as processing
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            processing_started_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Process the email (simplified for audit fix)
        const processed = await processEmail(supabase, email);
        results.push(processed);

      } catch (emailError) {
        console.error(`Failed to process email ${email.id}:`, emailError);
        
        // Mark as failed
        await supabase
          .from('communication_events')
          .update({ 
            status: 'failed',
            error_message: emailError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', email.id);

        results.push({ id: email.id, success: false, error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Process queue error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleHealthCheck(supabase: any): Promise<Response> {
  try {
    // Check database connectivity
    const { data, error } = await supabase
      .from('communication_events')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }

    // Check queue size
    const { data: queueData, error: queueError } = await supabase
      .from('communication_events')
      .select('count')
      .eq('status', 'queued');

    const queueSize = queueData?.[0]?.count || 0;

    return new Response(
      JSON.stringify({
        success: true,
        healthy: true,
        queueSize,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function checkRateLimit(supabase: any, email: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('communication_events')
      .select('count')
      .eq('recipient_email', email.toLowerCase())
      .gte('created_at', oneHourAgo);

    if (error) {
      console.warn('Rate limit check failed:', error.message);
      return { allowed: true }; // Allow on error to avoid blocking
    }

    const count = data?.[0]?.count || 0;
    const limit = 10; // 10 emails per hour per recipient

    return {
      allowed: count < limit,
      reason: count >= limit ? 'rate_limit_exceeded' : undefined
    };

  } catch (error) {
    console.warn('Rate limit check error:', error);
    return { allowed: true }; // Allow on error
  }
}

async function checkSuppressionList(supabase: any, email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('email_suppression_list')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.warn('Suppression check failed:', error.message);
      return false; // Don't suppress on error
    }

    return (data?.length || 0) > 0;

  } catch (error) {
    console.warn('Suppression check error:', error);
    return false; // Don't suppress on error
  }
}

async function processEmail(supabase: any, email: any): Promise<any> {
  // Process email using unified SMTP sender
  
  try {
    // Attempt to send email using unified-smtp-sender
    const emailResult = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: email.recipient_email,
        subject: email.payload?.subject || email.variables?.subject || 'Notification',
        htmlContent: email.payload?.htmlContent || email.variables?.html_content,
        textContent: email.payload?.textContent || email.variables?.text_content,
        templateKey: email.template_key,
        variables: email.variables
      }
    });

    if (emailResult.error || !emailResult.data?.success) {
      const errorMessage = emailResult.error?.message || emailResult.data?.error || 'Unknown sending error';
      throw new Error(errorMessage);
    }

    // Mark as sent
    await supabase
      .from('communication_events')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      })
      .eq('id', email.id);

    console.log(`Email ${email.id} sent successfully via unified-smtp-sender`);
    return { id: email.id, success: true };

  } catch (error) {
    console.error(`Failed to send email ${email.id}:`, error);
    
    // Mark as failed
    await supabase
      .from('communication_events')
      .update({ 
        status: 'failed',
        error_message: error.message,
        processed_at: new Date().toISOString()
      })
      .eq('id', email.id);

    throw error;
  }
}