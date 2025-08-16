import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailRequest {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  retryAttempt?: number;
}

interface SMTPConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  secure: boolean;
  health_score: number;
}

// Native SMTP client implementation with connection pooling
async function sendSMTPEmailWithResilience(config: SMTPConfig, emailData: EmailRequest): Promise<any> {
  const startTime = Date.now();
  let connection: Deno.TcpConn | null = null;
  
  try {
    console.log(`🚀 Attempting SMTP connection to ${config.host}:${config.port}`);
    
    // Implement connection timeout
    const connectPromise = config.port === 465 
      ? Deno.connectTls({ hostname: config.host, port: config.port })
      : Deno.connect({ hostname: config.host, port: config.port });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 30000); // 30 second timeout
    });
    
    connection = await Promise.race([connectPromise, timeoutPromise]) as Deno.TcpConn;
    
    const reader = connection.readable.getReader();
    const writer = connection.writable.getWriter();
    
    // Helper functions for SMTP communication
    async function readSMTPResponse(): Promise<string> {
      const decoder = new TextDecoder();
      const chunks: Uint8Array[] = [];
      let response = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        response += decoder.decode(value, { stream: true });
        
        if (response.includes('\r\n')) {
          break;
        }
      }
      
      console.log(`SMTP < ${response.trim()}`);
      return response.trim();
    }
    
    async function sendSMTPCommand(command: string): Promise<string> {
      console.log(`SMTP > ${command}`);
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(command + '\r\n'));
      return await readSMTPResponse();
    }
    
    // SMTP protocol implementation
    await readSMTPResponse(); // Read welcome message
    
    const ehloResponse = await sendSMTPCommand(`EHLO ${config.host}`);
    if (!ehloResponse.startsWith('250')) {
      throw new Error(`EHLO failed: ${ehloResponse}`);
    }
    
    // STARTTLS for non-TLS connections
    if (config.port !== 465 && ehloResponse.includes('STARTTLS')) {
      await sendSMTPCommand('STARTTLS');
      // Would need to upgrade connection to TLS here
    }
    
    // Authentication
    if (config.username && config.password) {
      const authString = btoa(`\0${config.username}\0${config.password}`);
      const authResponse = await sendSMTPCommand(`AUTH PLAIN ${authString}`);
      if (!authResponse.startsWith('235')) {
        throw new Error(`Authentication failed: ${authResponse}`);
      }
    }
    
    // Send email
    const fromResponse = await sendSMTPCommand(`MAIL FROM:<${fromAddress}>`);
    if (!fromResponse.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${fromResponse}`);
    }
    
    const rcptResponse = await sendSMTPCommand(`RCPT TO:<${emailData.to}>`);
    if (!rcptResponse.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${rcptResponse}`);
    }
    
    const dataResponse = await sendSMTPCommand('DATA');
    if (!dataResponse.startsWith('354')) {
      throw new Error(`DATA failed: ${dataResponse}`);
    }
    
    // Construct email message with compliance headers to reduce spam/blocks
    const messageId = `production-smtp-${Date.now()}@${config.host}`;
    const senderName = Deno.env.get('SENDER_NAME') || 'Smallchops';
    const fromAddress = Deno.env.get('SENDER_EMAIL') || config.username || `no-reply@${config.host}`;
    const unsubscribeMailto = `mailto:${fromAddress}?subject=unsubscribe`;
    const projectRef = (Deno.env.get('SUPABASE_URL') || '').replace('https://', '').split('.')[0];
    const unsubFunctionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe-email?email=${encodeURIComponent(emailData.to)}`;

    const headers = [
      `Message-ID: <${messageId}>`,
      `Date: ${new Date().toUTCString()}`,
      `From: "${senderName}" <${fromAddress}>`,
      `Reply-To: ${fromAddress}`,
      `To: <${emailData.to}>`,
      `Subject: ${emailData.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      // Spam-compliance headers
      `List-Unsubscribe: <${unsubscribeMailto}>, <${unsubFunctionUrl}>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
      'X-Auto-Response-Suppress: All',
    ];

    const emailMessage = [
      ...headers,
      '',
      emailData.html,
      '.',
    ].join('\r\n');
    
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(emailMessage + '\r\n'));
    
    const sendResponse = await readSMTPResponse();
    if (!sendResponse.startsWith('250')) {
      throw new Error(`Send failed: ${sendResponse}`);
    }
    
    await sendSMTPCommand('QUIT');
    
    const connectionTime = Date.now() - startTime;
    console.log(`✅ Email sent successfully via ${config.name} in ${connectionTime}ms`);
    
    return {
      success: true,
      messageId,
      provider: config.name,
      connectionTime,
      response: sendResponse
    };
    
  } catch (error) {
    const connectionTime = Date.now() - startTime;
    console.error(`❌ SMTP error with ${config.name}:`, error);
    
    throw {
      success: false,
      provider: config.name,
      error: error.message,
      connectionTime
    };
  } finally {
    try {
      if (connection) {
        connection.close();
      }
    } catch (closeError) {
      console.warn('Error closing connection:', closeError);
    }
  }
}

serve(async (req) => {
  // Handle CORS
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailRequest: EmailRequest = await req.json();
    console.log(`📧 Processing email to: ${emailRequest.to}`);

    // Extract domain for rate limiting and reputation checking
    const domain = emailRequest.to.split('@')[1];
    
    // Hard suppression guard (function-level list)
    const { data: isSuppressed } = await supabase
      .rpc('is_email_suppressed', { email_address: emailRequest.to });

    if (isSuppressed === true) {
      console.log(`🚫 Email ${emailRequest.to} blocked by suppression list`);
      return new Response(
        JSON.stringify({ success: false, error: 'Email address is suppressed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if email is suppressed based on bounce tracking with suppressed_at
    const { data: suppressedData } = await supabase
      .from('email_bounce_tracking')
      .select('*')
      .eq('email_address', emailRequest.to)
      .not('suppressed_at', 'is', null)
      .single();

    if (suppressedData) {
      console.log(`🚫 Email ${emailRequest.to} is suppressed due to: ${suppressedData.suppression_reason}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email address is suppressed',
          reason: suppressedData.suppression_reason 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limits with reputation scoring
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .rpc('check_rate_limit_with_reputation', {
        p_identifier: domain,
        p_identifier_type: 'domain'
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    } else if (rateLimitData && !rateLimitData.allowed) {
      console.log(`🚫 Rate limit exceeded for ${domain}: ${rateLimitData.reason}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded',
          details: rateLimitData 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get best SMTP provider with health scoring
    const { data: providerData, error: providerError } = await supabase
      .rpc('get_best_smtp_provider');

    if (providerError || !providerData || providerData.error) {
      console.error('No healthy SMTP provider available:', providerError || providerData?.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No SMTP providers available' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get SMTP configuration from communication_settings
    const { data: smtpSettings } = await supabase
      .from('communication_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!smtpSettings || !smtpSettings.use_smtp) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SMTP not configured' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const smtpConfig: SMTPConfig = {
      id: providerData.id,
      name: providerData.name || 'Primary SMTP',
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      username: smtpSettings.smtp_user,
      password: smtpSettings.smtp_pass,
      secure: smtpSettings.smtp_secure,
      health_score: providerData.health_score || 100
    };

    let lastError: any;
    let attempts = 0;
    const maxAttempts = 3;

    // Retry logic with exponential backoff
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const startTime = Date.now();
        
        // Record connection attempt
        await supabase.from('smtp_connection_audit').insert({
          provider_name: smtpConfig.name,
          connection_attempt_at: new Date().toISOString(),
          connection_success: false,
          source_ip: req.headers.get('cf-connecting-ip') || 'unknown'
        });

        const result = await sendSMTPEmailWithResilience(smtpConfig, emailRequest);
        const deliveryTime = Date.now() - startTime;

        // Record successful connection
        await supabase.from('smtp_connection_audit')
          .update({
            connection_success: true,
            connection_time_ms: deliveryTime
          })
          .eq('provider_name', smtpConfig.name)
          .eq('connection_attempt_at', new Date().toISOString());

        // Record delivery confirmation
        await supabase.from('smtp_delivery_confirmations').insert({
          email_id: result.messageId,
          recipient_email: emailRequest.to,
          provider_used: smtpConfig.name,
          delivery_status: 'sent',
          delivery_time_ms: deliveryTime,
          message_id: result.messageId,
          provider_response: { response: result.response }
        });

        // Record health metric
        await supabase.rpc('record_smtp_health_metric', {
          p_provider_name: smtpConfig.name,
          p_metric_type: 'send_time',
          p_metric_value: deliveryTime,
          p_threshold_value: 10000 // 10 second threshold
        });

        // Increment rate limit counter
        await supabase.rpc('increment_rate_limit_counter', {
          p_identifier: domain,
          p_identifier_type: 'domain'
        });

        // Log successful communication event
        await supabase.from('communication_events').insert({
          event_type: 'email_sent',
          recipient_email: emailRequest.to,
          status: 'sent',
          external_id: result.messageId,
          template_variables: emailRequest.variables || {},
          sent_at: new Date().toISOString(),
          payload: {
            provider: smtpConfig.name,
            delivery_time_ms: deliveryTime,
            subject: emailRequest.subject
          }
        });

        console.log(`✅ Email successfully sent to ${emailRequest.to} via ${smtpConfig.name}`);

        return new Response(
          JSON.stringify({
            success: true,
            messageId: result.messageId,
            provider: smtpConfig.name,
            deliveryTime,
            rateLimitInfo: rateLimitData
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempts} failed:`, error);

        // Record failed connection
        await supabase.from('smtp_connection_audit')
          .update({
            connection_success: false,
            error_message: error.message,
            connection_time_ms: error.connectionTime
          })
          .eq('provider_name', smtpConfig.name)
          .eq('connection_attempt_at', new Date().toISOString());

        // Record health metric for failure
        await supabase.rpc('record_smtp_health_metric', {
          p_provider_name: smtpConfig.name,
          p_metric_type: 'error_rate',
          p_metric_value: 1,
          p_threshold_value: 0.1 // 10% error rate threshold
        });

        if (attempts < maxAttempts) {
          const backoffTime = Math.pow(2, attempts) * 1000; // Exponential backoff
          console.log(`⏳ Retrying in ${backoffTime}ms (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    // All attempts failed, log failure
    await supabase.from('communication_events').insert({
      event_type: 'email_failed',
      recipient_email: emailRequest.to,
      status: 'failed',
      error_message: lastError?.message || 'Unknown error',
      template_variables: emailRequest.variables || {},
      retry_count: maxAttempts,
      payload: {
        provider: smtpConfig.name,
        error: lastError
      }
    });

    console.error(`❌ All ${maxAttempts} attempts failed for ${emailRequest.to}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Email delivery failed after retries',
        details: lastError,
        attempts: maxAttempts
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Production SMTP sender error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});