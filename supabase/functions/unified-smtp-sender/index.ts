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

// Input sanitization and validation
function sanitizeEmailAddress(email: string): string {
  return email.trim().toLowerCase().replace(/[^\w@.-]/g, '');
}

function sanitizeSubject(subject: string): string {
  if (!subject) return 'No Subject';
  
  // Remove control characters and ensure single line
  return subject
    .replace(/[\r\n\t]/g, ' ')        // Replace line breaks with spaces
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Keep printable ASCII + Unicode
    .trim()
    .substring(0, 255);               // RFC 5321 limit
}

function sanitizeContent(content: string): string {
  if (!content) return '';
  
  // Ensure UTF-8 encoding
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const encodedContent = encoder.encode(content);
  const validUtf8Content = decoder.decode(encodedContent);
  
  // SMTP dot-stuffing and line ending normalization
  return validUtf8Content
    .replace(/\r?\n/g, '\r\n')        // Normalize line endings
    .replace(/^\./gm, '..')           // Dot-stuffing for SMTP
    .replace(/\r\n\./g, '\r\n..');    // Additional dot-stuffing
}

function buildMimeMessage(from: string, to: string, subject: string, html?: string, text?: string): string {
  const messageId = `unified-${Date.now()}-${Math.random().toString(36).substring(2)}@smtp-sender`;
  const boundary = `boundary-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  
  const headers = [
    `Message-ID: <${messageId}>`,
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${sanitizeSubject(subject)}`,
    'MIME-Version: 1.0'
  ];

  let body = '';

  // Determine content structure
  if (html && text) {
    // Multipart alternative (HTML + text)
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      '',
      'This is a multi-part message in MIME format.',
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      sanitizeContent(text),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      sanitizeContent(html),
      '',
      `--${boundary}--`
    ].join('\r\n');
  } else if (html) {
    // HTML only
    headers.push(
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit'
    );
    body = '\r\n' + sanitizeContent(html);
  } else {
    // Plain text only
    headers.push(
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit'
    );
    body = '\r\n' + sanitizeContent(text || '');
  }

  return headers.join('\r\n') + body;
}

// Enhanced SMTP implementation with resilience
async function sendViaSMTP(config: any, emailData: any) {
  const { host, port, auth, secure } = config;
  const { from, to, subject, html, text } = emailData;

  // Input validation
  if (!to || !sanitizeEmailAddress(to).includes('@')) {
    throw new Error('Invalid recipient email address');
  }
  if (!from || !sanitizeEmailAddress(from).includes('@')) {
    throw new Error('Invalid sender email address');
  }

  const sanitizedTo = sanitizeEmailAddress(to);
  const sanitizedFrom = sanitizeEmailAddress(from);

  console.log(`📧 SMTP Connection: ${host}:${port} (${secure ? 'SSL/TLS' : 'STARTTLS'})`);

  let conn: Deno.TlsConn | Deno.Conn | null = null;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      // Connection timeout and retry logic
      const connectPromise = secure || port === 465
        ? Deno.connectTls({ hostname: host, port: port })
        : Deno.connect({ hostname: host, port: port });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout after 15s to ${host}:${port}`)), 15000);
      });

      conn = await Promise.race([connectPromise, timeoutPromise]);

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Command helper with individual timeouts
      async function sendCommand(command: string, timeout = 10000): Promise<string> {
        if (!conn) throw new Error('No connection available');
        
        const cmdToLog = command.startsWith('AUTH PLAIN') || command.includes('PASS') 
          ? command.replace(/PASS .+/, 'PASS ***').replace(/AUTH PLAIN .+/, 'AUTH PLAIN ***')
          : command;
        
        console.log(`SMTP > ${cmdToLog}`);
        
        await conn.write(encoder.encode(command + '\r\n'));
        
        const readPromise = async () => {
          const buffer = new Uint8Array(4096);
          const bytesRead = await conn!.read(buffer);
          
          if (bytesRead === null) {
            throw new Error('Connection closed unexpectedly');
          }
          
          return decoder.decode(buffer.slice(0, bytesRead)).trim();
        };

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Command timeout: ${cmdToLog}`)), timeout);
        });

        const response = await Promise.race([readPromise(), timeoutPromise]);
        console.log(`SMTP < ${response}`);
        
        return response;
      }

      // Read greeting with timeout
      const greetingPromise = async () => {
        const buffer = new Uint8Array(1024);
        const bytesRead = await conn!.read(buffer);
        if (bytesRead === null) throw new Error('No greeting received');
        return decoder.decode(buffer.slice(0, bytesRead)).trim();
      };

      const greetingTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Greeting timeout')), 10000);
      });

      const greeting = await Promise.race([greetingPromise(), greetingTimeout]);
      console.log(`SMTP < ${greeting}`);
      
      if (!greeting.startsWith('220')) {
        throw new Error(`Invalid greeting: ${greeting}`);
      }

      // EHLO with capability detection
      let response = await sendCommand(`EHLO ${host}`);
      if (!response.startsWith('250')) {
        throw new Error(`EHLO failed: ${response}`);
      }

      const capabilities = response.split('\r\n').map(line => line.substring(4));
      const supportsStartTLS = capabilities.some(cap => cap.toUpperCase().includes('STARTTLS'));

      // Enhanced STARTTLS handling
      if (!secure && port === 587 && supportsStartTLS) {
        console.log('🔐 Initiating STARTTLS...');
        response = await sendCommand('STARTTLS');
        if (!response.startsWith('220')) {
          throw new Error(`STARTTLS failed: ${response}`);
        }
        
        // Gracefully close and upgrade
        conn.close();
        
        console.log('🔄 Upgrading to TLS connection...');
        const tlsConnectPromise = Deno.connectTls({ hostname: host, port: port });
        const tlsTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TLS upgrade timeout')), 10000);
        });

        conn = await Promise.race([tlsConnectPromise, tlsTimeoutPromise]);
        
        // Re-send EHLO after TLS upgrade
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

      // Mail transaction
      const fromEmail = sanitizedFrom.includes('<') ? sanitizedFrom.match(/<([^>]+)>/)?.[1] || sanitizedFrom : sanitizedFrom;
      response = await sendCommand(`MAIL FROM:<${fromEmail}>`);
      if (!response.startsWith('250')) {
        throw new Error(`MAIL FROM failed: ${response}`);
      }

      response = await sendCommand(`RCPT TO:<${sanitizedTo}>`);
      if (!response.startsWith('250')) {
        throw new Error(`RCPT TO failed: ${response}`);
      }

      response = await sendCommand('DATA');
      if (!response.startsWith('354')) {
        throw new Error(`DATA failed: ${response}`);
      }

      // Build RFC-compliant message
      const emailContent = buildMimeMessage(from, sanitizedTo, subject, html, text);
      
      console.log('📧 Sending email content...');
      
      // Send the email content
      await conn.write(encoder.encode(emailContent));
      
      // Send the termination sequence (CRLF.CRLF)
      await conn.write(encoder.encode('\r\n.\r\n'));
      
      // Wait for server response with timeout
      const dataResponsePromise = async () => {
        const buffer = new Uint8Array(1024);
        const bytesRead = await conn.read(buffer);
        if (bytesRead === null) {
          throw new Error('Connection closed during data response');
        }
        return decoder.decode(buffer.slice(0, bytesRead)).trim();
      };
      
      const dataTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Data response timeout')), 15000);
      });
      
      const dataResponse = await Promise.race([
        dataResponsePromise(),
        dataTimeoutPromise
      ]);
      
      console.log(`SMTP < ${dataResponse}`);
      
      if (!dataResponse.startsWith('250')) {
        throw new Error(`Email sending failed: ${dataResponse}`);
      }

      await sendCommand('QUIT');
      conn.close();
      conn = null;

      console.log('✅ Email sent successfully via Unified SMTP');
      
      return {
        messageId: emailContent.match(/Message-ID: <([^>]+)>/)?.[1] || `unified-${Date.now()}`,
        accepted: [sanitizedTo],
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
        conn = null;
      }

      // Retry logic for transient errors
      if (retryCount < maxRetries && (
        error.message.includes('timeout') ||
        error.message.includes('Connection closed') ||
        error.message.includes('ECONNRESET')
      )) {
        retryCount++;
        const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`🔄 Retrying SMTP connection (${retryCount}/${maxRetries}) after ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      console.error('❌ SMTP error:', error);
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
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

    // Validation function
    function validateEmailData(emailData: any) {
      const { from, to, subject, html, text } = emailData;
      
      // Validate required fields
      if (!to || !to.trim()) {
        throw new Error('Recipient email is required');
      }
      
      if (!from || !from.trim()) {
        throw new Error('Sender email is required');
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const toEmail = to.includes('<') ? to.match(/<([^>]+)>/)?.[1] || to : to;
      const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from;
      
      if (!emailRegex.test(toEmail)) {
        throw new Error(`Invalid recipient email format: ${toEmail}`);
      }
      
      if (!emailRegex.test(fromEmail)) {
        throw new Error(`Invalid sender email format: ${fromEmail}`);
      }
      
      // Ensure we have some content
      if (!html && !text) {
        throw new Error('Email must have either HTML or text content');
      }
      
      // Validate content length (prevent oversized emails)
      const totalSize = (html || '').length + (text || '').length + (subject || '').length;
      if (totalSize > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Email content exceeds size limit');
      }
      
      return true;
    }

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

    // Configure SMTP with auto-correction
    const port = smtpSettings.smtp_port || 587;
    const smtpConfig = {
      host: smtpSettings.smtp_host,
      port: port,
      // Auto-correct secure flag based on port
      secure: port === 465 ? true : (port === 587 ? false : smtpSettings.smtp_secure === true),
      auth: {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_pass,
      },
    };

    console.log('🔧 SMTP Config normalized:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user.substring(0, 3) + '***'
    });

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

    console.log('🔍 Validating email data...');
    validateEmailData(finalEmailData);

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