// Unified Production SMTP Sender - Single Source of Truth
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

// Production CORS configuration
const getAllowedOrigins = () => {
  const envType = Deno.env.get('DENO_ENV') || 'development';
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || '*';
  
  if (envType === 'production') {
    return allowedOrigins.split(',').map(origin => origin.trim());
  }
  
  return ['*'];
};

const getCorsHeaders = (origin?: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = allowedOrigins.includes('*') || 
    (origin && allowedOrigins.includes(origin)) ? 
    (origin || '*') : allowedOrigins[0];
    
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateKey?: string;
  recipient?: {
    email: string;
    name?: string;
  };
  variables?: Record<string, string>;
  emailType?: string;
  priority?: 'high' | 'normal' | 'low';
}

// Template variable replacement
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

// Production-ready SMTP implementation
async function sendViaSMTP(config: any, emailData: any) {
  const { host, port, auth, secure } = config;
  const { from, to, subject, html, text } = emailData;

  console.log(`📧 SMTP Connection: ${host}:${port} (${secure ? 'SSL/TLS' : 'STARTTLS'})`);

  let conn: Deno.TlsConn | Deno.Conn | null = null;

  try {
    // Enhanced connection with proper timeout
    const connectPromise = secure || port === 465
      ? Deno.connectTls({ hostname: host, port: port })
      : Deno.connect({ hostname: host, port: port });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after 30s to ${host}:${port}`)), 30000);
    });

    conn = await Promise.race([connectPromise, timeoutPromise]) as Deno.TlsConn | Deno.Conn;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // SMTP command helper
    async function sendCommand(command: string): Promise<string> {
      if (!conn) throw new Error('No connection available');
      
      // Mask sensitive data in logs
      const cmdToLog = command.startsWith('AUTH PLAIN') || command.includes('PASS') 
        ? command.replace(/PASS .+/, 'PASS ***').replace(/AUTH PLAIN .+/, 'AUTH PLAIN ***')
        : command;
      
      console.log(`SMTP > ${cmdToLog}`);
      
      await conn.write(encoder.encode(command + '\r\n'));
      
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      
      if (bytesRead === null) {
        throw new Error('Connection closed unexpectedly');
      }
      
      const response = decoder.decode(buffer.slice(0, bytesRead)).trim();
      console.log(`SMTP < ${response}`);
      
      return response;
    }

    // Read initial greeting
    const buffer = new Uint8Array(1024);
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) throw new Error('No greeting received');
    
    const greeting = decoder.decode(buffer.slice(0, bytesRead)).trim();
    console.log(`SMTP < ${greeting}`);
    
    if (!greeting.startsWith('220')) {
      throw new Error(`Invalid greeting: ${greeting}`);
    }

    // Send EHLO
    let response = await sendCommand(`EHLO ${host}`);
    if (!response.startsWith('250')) {
      throw new Error(`EHLO failed: ${response}`);
    }

    // STARTTLS for port 587
    if (!secure && port === 587) {
      console.log('🔐 Initiating STARTTLS...');
      response = await sendCommand('STARTTLS');
      if (!response.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${response}`);
      }
      
      // Close and upgrade to TLS
      conn.close();
      
      console.log('🔄 Upgrading to TLS connection...');
      conn = await Deno.connectTls({ hostname: host, port: port });
      
      // Send EHLO again after TLS upgrade
      response = await sendCommand(`EHLO ${host}`);
      if (!response.startsWith('250')) {
        throw new Error(`EHLO after STARTTLS failed: ${response}`);
      }
      console.log('✅ TLS upgrade successful');
    }

    // Authentication
    const authString = btoa(`\0${auth.user}\0${auth.pass}`);
    response = await sendCommand(`AUTH PLAIN ${authString}`);
    
    if (!response.startsWith('235')) {
      throw new Error(`Authentication failed: ${response}`);
    }

    // Send email
    const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from;
    response = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response}`);
    }

    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response}`);
    }

    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      throw new Error(`DATA failed: ${response}`);
    }

    // Construct email with proper headers
    const messageId = `unified-smtp-${Date.now()}@${host}`;
    const emailContent = [
      `Message-ID: <${messageId}>`,
      `Date: ${new Date().toUTCString()}`,
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      html ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8',
      '',
      html || text || '',
      '.'
    ].join('\r\n');

    await conn.write(encoder.encode(emailContent + '\r\n'));
    
    const dataBuffer = new Uint8Array(1024);
    const dataRead = await conn.read(dataBuffer);
    if (dataRead === null) throw new Error('No response to DATA');
    
    const dataResponse = decoder.decode(dataBuffer.slice(0, dataRead)).trim();
    console.log(`SMTP < ${dataResponse}`);
    
    if (!dataResponse.startsWith('250')) {
      throw new Error(`Email sending failed: ${dataResponse}`);
    }

    await sendCommand('QUIT');
    conn.close();
    conn = null;

    console.log('✅ Email sent successfully via Unified SMTP');
    
    return {
      messageId,
      accepted: [to],
      rejected: [],
      response: dataResponse
    };

  } catch (error) {
    if (conn) {
      try {
        conn.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
    console.error('❌ SMTP error:', error);
    throw error;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody: EmailRequest = await req.json();
    
    console.log('📨 Unified SMTP Request:', {
      to: requestBody.to || requestBody.recipient?.email,
      templateId: requestBody.templateId || requestBody.templateKey,
      subject: requestBody.subject
    });

    // Normalize email data
    let emailData = {
      to: requestBody.to || requestBody.recipient?.email,
      subject: requestBody.subject || '',
      html: requestBody.html || '',
      text: requestBody.text || '',
      variables: requestBody.variables || {},
      templateKey: requestBody.templateId || requestBody.templateKey,
      emailType: requestBody.emailType || 'transactional'
    };

    if (!emailData.to) {
      throw new Error('Recipient email is required');
    }

    // Check rate limits
    const { data: rateLimitResult } = await supabase.rpc('check_email_rate_limit', {
      p_recipient_email: emailData.to
    });

    if (rateLimitResult && !rateLimitResult.allowed) {
      console.log(`🚫 Rate limit exceeded for ${emailData.to}: ${rateLimitResult.reason}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          details: rateLimitResult
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Process template if specified
    if (emailData.templateKey) {
      console.log('🎨 Processing template:', emailData.templateKey);
      
      const { data: template, error: templateError } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('template_key', emailData.templateKey)
        .eq('is_active', true)
        .maybeSingle();

      if (template && !templateError) {
        // Get business settings for variables
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('name, email, website_url, primary_color, secondary_color')
          .limit(1)
          .maybeSingle();

        // Merge variables with defaults
        const allVariables = {
          companyName: businessSettings?.name || 'Starters Small Chops',
          supportEmail: businessSettings?.email || 'support@startersmallchops.com',
          websiteUrl: businessSettings?.website_url || 'https://startersmallchops.com',
          primaryColor: businessSettings?.primary_color || '#f59e0b',
          secondaryColor: businessSettings?.secondary_color || '#d97706',
          customerName: requestBody.recipient?.name || 'Valued Customer',
          ...emailData.variables
        };

        emailData.subject = replaceVariables(template.subject_template, allVariables);
        emailData.html = replaceVariables(template.html_template, allVariables);
        emailData.text = template.text_template 
          ? replaceVariables(template.text_template, allVariables)
          : emailData.html.replace(/<[^>]*>/g, '');

        console.log('✅ Template processed successfully');
      } else {
        console.warn('⚠️ Template not found, using direct content');
      }
    }

    // Ensure we have content
    if (!emailData.subject) {
      emailData.subject = 'Notification from Starters Small Chops';
    }

    if (!emailData.html && emailData.text) {
      emailData.html = `<p>${emailData.text.replace(/\n/g, '<br>')}</p>`;
    }

    // Get SMTP settings
    const { data: smtpSettings, error: settingsError } = await supabase
      .from('communication_settings')
      .select('*')
      .eq('use_smtp', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError || !smtpSettings) {
      throw new Error('SMTP configuration not found');
    }

    console.log('⚙️ SMTP Settings loaded:', {
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      user: smtpSettings.smtp_user,
      secure: smtpSettings.smtp_secure
    });

    // Validate SMTP configuration
    if (!smtpSettings.smtp_host || !smtpSettings.smtp_user || !smtpSettings.smtp_pass || !smtpSettings.sender_email) {
      throw new Error('Incomplete SMTP configuration');
    }

    // Configure SMTP
    const smtpConfig = {
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port || 587,
      secure: smtpSettings.smtp_secure === true,
      auth: {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_pass,
      },
    };

    // Prepare email for sending
    const finalEmailData = {
      from: smtpSettings.sender_name 
        ? `"${smtpSettings.sender_name}" <${smtpSettings.sender_email}>`
        : smtpSettings.sender_email,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || (emailData.html ? emailData.html.replace(/<[^>]*>/g, '') : ''),
    };

    console.log('📤 Sending email via Unified SMTP...');
    const startTime = Date.now();
    
    // Send email via SMTP
    const result = await sendViaSMTP(smtpConfig, finalEmailData);
    const deliveryTime = Date.now() - startTime;

    // Log email delivery
    await supabase.rpc('log_email_delivery', {
      p_message_id: result.messageId,
      p_recipient_email: emailData.to,
      p_subject: emailData.subject,
      p_provider: 'unified_smtp',
      p_status: 'sent',
      p_template_key: emailData.templateKey,
      p_variables: emailData.variables,
      p_smtp_response: result.response
    });

    console.log('✅ Email sent and logged successfully');
    console.log(`📊 Delivery time: ${deliveryTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        provider: 'unified_smtp',
        deliveryTime,
        templateUsed: emailData.templateKey || null,
        rateLimitInfo: rateLimitResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Unified SMTP Error:', error);
    
    // Log failed delivery
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const requestData = await req.text().then(t => JSON.parse(t)).catch(() => ({}));
      
      await supabase.rpc('log_email_delivery', {
        p_message_id: `failed-${Date.now()}`,
        p_recipient_email: requestData.to || requestData.recipient?.email || 'unknown',
        p_subject: requestData.subject || 'Failed Email',
        p_provider: 'unified_smtp',
        p_status: 'failed',
        p_template_key: requestData.templateId || requestData.templateKey,
        p_variables: requestData.variables || {},
        p_smtp_response: error.message
      });
    } catch (logError) {
      console.error('Failed to log delivery error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'unified_smtp',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});