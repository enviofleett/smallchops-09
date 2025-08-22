import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
import { getCorsHeaders } from "../_shared/cors.ts";
import { EmailRateLimiter } from "../_shared/email-rate-limiter.ts";
import { EmailRetryManager } from "../_shared/email-retry-manager.ts";

// Email system health check
function validateEmailEnvironment(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!Deno.env.get('SUPABASE_URL')) issues.push('SUPABASE_URL not set');
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) issues.push('SUPABASE_SERVICE_ROLE_KEY not set');
  
  const envType = Deno.env.get('DENO_ENV') || 'development';
  if (envType === 'production' && !Deno.env.get('ALLOWED_ORIGINS')) {
    issues.push('ALLOWED_ORIGINS not set for production');
  }
  
  return { valid: issues.length === 0, issues };
}

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

// Template variable replacement with enhanced error handling
function replaceVariables(template: string, variables: Record<string, string>): string {
  if (!template) return '';
  
  let result = template;
  try {
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Use stricter regex to handle whitespace around variable names
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value));
      }
    });
    
    // Check for unreplaced variables and warn
    const unreplacedMatches = result.match(/{{[^}]+}}/g);
    if (unreplacedMatches) {
      console.warn('⚠️ Unreplaced variables in template:', unreplacedMatches);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in template variable replacement:', error);
    return template; // Return original template if replacement fails
  }
}

// Native SMTP implementation with enhanced security
async function sendViaSMTP(config: any, emailData: any) {
  const { host, port, auth, secure } = config;
  const { from, to, subject, html, text } = emailData;

  console.log(`📧 SMTP Connection: ${host}:${port} (${secure ? 'SSL/TLS' : 'STARTTLS'})`);

  let conn: Deno.TlsConn | Deno.Conn | null = null;

  try {
    // Enhanced connection with timeout
    const connectPromise = secure || port === 465
      ? Deno.connectTls({ hostname: host, port: port })
      : Deno.connect({ hostname: host, port: port });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after 30s to ${host}:${port}`)), 30000);
    });

    conn = await Promise.race([connectPromise, timeoutPromise]) as Deno.TlsConn | Deno.Conn;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper to send SMTP commands with enhanced error handling
    async function sendCommand(command: string): Promise<string> {
      if (!conn) throw new Error('No connection available');
      
      // Mask sensitive data in logs
      const cmdToLog = command.startsWith('AUTH PLAIN') || command.includes('PASS') 
        ? command.replace(/PASS .+/, 'PASS ***').replace(/AUTH PLAIN .+/, 'AUTH PLAIN ***')
        : command;
      
      console.log(`SMTP > ${cmdToLog}`);
      
      await conn.write(encoder.encode(command + '\r\n'));
      
      // Enhanced response reading with timeout
      const buffer = new Uint8Array(4096); // Increased buffer size
      const readPromise = conn.read(buffer);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command response timeout')), 10000);
      });
      
      const bytesRead = await Promise.race([readPromise, timeoutPromise]) as number | null;
      
      if (bytesRead === null) {
        throw new Error('Connection closed unexpectedly');
      }
      
      const response = decoder.decode(buffer.slice(0, bytesRead)).trim();
      console.log(`SMTP < ${response}`);
      
      return response;
    }

    // Read initial greeting with timeout
    const buffer = new Uint8Array(4096);
    const greetingPromise = conn.read(buffer);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Greeting timeout')), 10000);
    });
    
    const bytesRead = await Promise.race([greetingPromise, timeoutPromise]) as number | null;
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

    // STARTTLS for non-secure connections
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

    // Enhanced authentication with better error messages
    if (auth && auth.user && auth.pass) {
      // Fix AUTH PLAIN encoding - ensure proper null byte separation
      const authString = btoa(`\0${auth.user}\0${auth.pass}`);
      response = await sendCommand(`AUTH PLAIN ${authString}`);
      
      if (!response.startsWith('235')) {
        throw new Error(`Authentication failed: ${response} (Check username/password)`);
      }
      console.log('✅ Authentication successful');
    } else {
      throw new Error('SMTP credentials are required but not provided');
    }

    // Send email
    const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from;
    response = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response}`);
    }

    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response} (Check recipient email)`);
    }

    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      throw new Error(`DATA failed: ${response}`);
    }

    // Construct email with enhanced headers for deliverability
    const messageId = `prod-email-${Date.now()}-${Math.random().toString(36).substring(2)}@${host}`;
    const emailContent = [
      `Message-ID: <${messageId}>`,
      `Date: ${new Date().toUTCString()}`,
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      html ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8',
      'X-Mailer: Starters Small Chops Email System v2.0',
      'X-Priority: 3',
      '',
      html || text || '',
      '.'
    ].join('\r\n');

    await conn.write(encoder.encode(emailContent + '\r\n'));
    
    const dataBuffer = new Uint8Array(4096);
    const dataReadPromise = conn.read(dataBuffer);
    const dataTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Data response timeout')), 30000);
    });
    
    const dataRead = await Promise.race([dataReadPromise, dataTimeoutPromise]) as number | null;
    if (dataRead === null) throw new Error('No response to DATA');
    
    const dataResponse = decoder.decode(dataBuffer.slice(0, dataRead)).trim();
    console.log(`SMTP < ${dataResponse}`);
    
    if (!dataResponse.startsWith('250')) {
      throw new Error(`Email sending failed: ${dataResponse}`);
    }

    await sendCommand('QUIT');
    conn.close();
    conn = null;

    console.log('✅ Email sent successfully via SMTP');
    
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
    // Environment validation
    const envCheck = validateEmailEnvironment();
    if (!envCheck.valid) {
      console.error('❌ Environment validation failed:', envCheck.issues);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email system configuration error',
          details: envCheck.issues
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody: EmailRequest = await req.json();
    
    console.log('📨 Production Email Processor Request:', {
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

    // Enhanced email validation
    function validateEmail(email: string): boolean {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    if (!emailData.to) {
      throw new Error('Recipient email is required');
    }

    if (!validateEmail(emailData.to)) {
      throw new Error('Invalid recipient email format');
    }

    // Enhanced rate limiting with email-specific logic
    const rateLimitResult = await EmailRateLimiter.checkEmailRateLimit({
      recipient: emailData.to,
      emailType: emailData.emailType as 'transactional' | 'marketing' | 'notification' | 'system',
      senderIp: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
      templateKey: emailData.templateKey
    });

    if (!rateLimitResult.allowed) {
      console.log(`🚫 Email rate limit exceeded for ${emailData.to}: ${rateLimitResult.reason}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email rate limit exceeded',
          reason: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter,
          limits: {
            hourlyRemaining: rateLimitResult.hourlyRemaining,
            dailyRemaining: rateLimitResult.dailyRemaining
          }
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': rateLimitResult.retryAfter?.toString() || '3600'
          }
        }
      );
    }

    // Check email suppression (bounces, complaints, etc.)
    const suppressionCheck = await EmailRateLimiter.checkEmailSuppression(emailData.to);
    if (suppressionCheck.suppressed) {
      console.log(`🚫 Email suppressed for ${emailData.to}: ${suppressionCheck.reason}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email address is suppressed',
          reason: suppressionCheck.reason
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Enhanced template processing with fallbacks
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

        // Enhanced variable merging with type safety
        const allVariables = {
          companyName: businessSettings?.name || 'Starters Small Chops',
          supportEmail: businessSettings?.email || 'support@startersmallchops.com',
          websiteUrl: businessSettings?.website_url || 'https://startersmallchops.com',
          primaryColor: businessSettings?.primary_color || '#f59e0b',
          secondaryColor: businessSettings?.secondary_color || '#d97706',
          customerName: requestBody.recipient?.name || emailData.variables?.customer_name || 'Valued Customer',
          currentDate: new Date().toLocaleDateString(),
          currentYear: new Date().getFullYear().toString(),
          ...emailData.variables
        };

        try {
          emailData.subject = replaceVariables(template.subject_template, allVariables);
          emailData.html = replaceVariables(template.html_template, allVariables);
          emailData.text = template.text_template 
            ? replaceVariables(template.text_template, allVariables)
            : emailData.html.replace(/<[^>]*>/g, '');

          console.log('✅ Template processed successfully');
        } catch (templateProcessingError) {
          console.error('❌ Template processing failed:', templateProcessingError);
          throw new Error(`Template processing failed: ${templateProcessingError.message}`);
        }
      } else {
        console.warn('⚠️ Template not found, checking for fallbacks...');
        
        // Provide basic fallback templates for critical email types
        const fallbackTemplates = {
          'customer_welcome': {
            subject: `Welcome to ${emailData.variables?.companyName || 'Starters Small Chops'}!`,
            html: `<h1>Welcome!</h1><p>Hello ${emailData.variables?.customerName || 'Valued Customer'},</p><p>Thank you for joining us!</p>`,
            text: `Welcome! Hello ${emailData.variables?.customerName || 'Valued Customer'}, thank you for joining us!`
          },
          'order_confirmation': {
            subject: `Order Confirmation - ${emailData.variables?.orderNumber || 'Your Order'}`,
            html: `<h1>Order Confirmed</h1><p>Hello ${emailData.variables?.customerName || 'Customer'},</p><p>Your order has been confirmed.</p>`,
            text: `Order Confirmed. Hello ${emailData.variables?.customerName || 'Customer'}, your order has been confirmed.`
          }
        };

        const fallback = fallbackTemplates[emailData.templateKey];
        if (fallback) {
          console.log('📝 Using fallback template for:', emailData.templateKey);
          emailData.subject = fallback.subject;
          emailData.html = fallback.html;
          emailData.text = fallback.text;
        } else {
          throw new Error(`Template '${emailData.templateKey}' not found and no fallback available`);
        }
      }
    }

    // Enhanced content validation and fallback
    if (!emailData.subject) {
      emailData.subject = emailData.templateKey 
        ? `Notification from ${emailData.variables?.companyName || 'Starters Small Chops'}`
        : 'Important Notification';
    }

    if (!emailData.html && !emailData.text) {
      throw new Error('Email must have either HTML or text content');
    }

    if (!emailData.html && emailData.text) {
      emailData.html = `<p>${emailData.text.replace(/\n/g, '<br>')}</p>`;
    }

    if (!emailData.text && emailData.html) {
      emailData.text = emailData.html.replace(/<[^>]*>/g, '');
    }

    // Get SMTP settings with enhanced validation
    const { data: smtpSettings, error: settingsError } = await supabase
      .from('communication_settings')
      .select('*')
      .eq('use_smtp', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('❌ SMTP settings query error:', settingsError);
      throw new Error(`SMTP configuration error: ${settingsError.message}`);
    }

    if (!smtpSettings) {
      throw new Error('No SMTP configuration found - please configure email settings');
    }

    console.log('⚙️ SMTP Settings loaded:', {
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      user: smtpSettings.smtp_user,
      secure: smtpSettings.smtp_secure,
      hasPassword: !!smtpSettings.smtp_pass,
      senderEmail: smtpSettings.sender_email
    });

    // Enhanced SMTP configuration validation
    const missingFields = [];
    if (!smtpSettings.smtp_host) missingFields.push('SMTP host');
    if (!smtpSettings.smtp_user) missingFields.push('SMTP username');
    if (!smtpSettings.smtp_pass) missingFields.push('SMTP password');
    if (!smtpSettings.sender_email) missingFields.push('Sender email');

    if (missingFields.length > 0) {
      throw new Error(`Incomplete SMTP configuration. Missing: ${missingFields.join(', ')}`);
    }

    // Validate email format for sender
    if (!validateEmail(smtpSettings.sender_email)) {
      throw new Error('Invalid sender email format in SMTP configuration');
    }

    // Configure SMTP with enhanced settings
    const smtpConfig = {
      host: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port || 587,
      secure: smtpSettings.smtp_secure !== false,
      auth: {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_pass,
      },
    };

    // Prepare email for sending with enhanced headers
    const finalEmailData = {
      from: smtpSettings.sender_name 
        ? `"${smtpSettings.sender_name}" <${smtpSettings.sender_email}>`
        : smtpSettings.sender_email,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || (emailData.html ? emailData.html.replace(/<[^>]*>/g, '') : ''),
    };

    console.log('📤 Sending email via enhanced SMTP with retry logic...');
    const startTime = Date.now();
    
    // Send email via SMTP with enhanced retry logic and circuit breaker
    let result;
    try {
      result = await EmailRetryManager.executeWithRetry(
        () => sendViaSMTP(smtpConfig, finalEmailData),
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 30000,
          backoffMultiplier: 2,
          jitter: true
        },
        {
          recipient: emailData.to,
          templateKey: emailData.templateKey
        }
      );
    } catch (smtpError) {
      console.error('❌ SMTP sending failed after all retries:', smtpError);
      
      // Check if it's a circuit breaker failure
      if (smtpError.message.includes('circuit breaker')) {
        throw new Error(`Email service temporarily unavailable: ${smtpError.message}`);
      }
      
      throw new Error(`Email delivery failed: ${smtpError.message}`);
    }
    
    const deliveryTime = Date.now() - startTime;

    // Enhanced delivery logging with retry information
    await supabase.rpc('log_email_delivery', {
      p_message_id: result.messageId,
      p_recipient_email: emailData.to,
      p_subject: emailData.subject,
      p_provider: 'production_smtp',
      p_status: 'sent',
      p_template_key: emailData.templateKey,
      p_variables: emailData.variables,
      p_smtp_response: result.response,
      p_delivery_time_ms: deliveryTime,
      p_sender_ip: req.headers.get('cf-connecting-ip') || 'unknown'
    });

    console.log('✅ Email sent and logged successfully');
    console.log(`📊 Delivery time: ${deliveryTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        provider: 'production_smtp',
        deliveryTime,
        templateUsed: emailData.templateKey || null,
        rateLimitInfo: {
          hourlyRemaining: rateLimitResult.hourlyRemaining,
          dailyRemaining: rateLimitResult.dailyRemaining
        },
        circuitBreakerStatus: EmailRetryManager.getCircuitStatus()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Production Email Processor Error:', error);
    
    // Enhanced error categorization for better user feedback
    let errorType = 'system_error';
    let userMessage = 'Email delivery failed';
    let statusCode = 500;

    if (error.message.includes('Authentication failed')) {
      errorType = 'auth_error';
      userMessage = 'Email server authentication failed';
      statusCode = 502;
    } else if (error.message.includes('Connection timeout') || error.message.includes('Connection closed')) {
      errorType = 'connection_error';
      userMessage = 'Email server connection failed';
      statusCode = 503;
    } else if (error.message.includes('Invalid') && error.message.includes('email')) {
      errorType = 'validation_error';
      userMessage = 'Invalid email address';
      statusCode = 400;
    } else if (error.message.includes('Template') && error.message.includes('not found')) {
      errorType = 'template_error';
      userMessage = 'Email template not available';
      statusCode = 404;
    } else if (error.message.includes('Rate limit')) {
      errorType = 'rate_limit_error';
      userMessage = 'Too many emails sent recently';
      statusCode = 429;
    } else if (error.message.includes('configuration')) {
      errorType = 'config_error';
      userMessage = 'Email system configuration error';
      statusCode = 503;
    }
    
    // Log failed delivery with enhanced error details
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
        p_provider: 'production_smtp',
        p_status: 'failed',
        p_template_key: requestData.templateId || requestData.templateKey,
        p_variables: requestData.variables || {},
        p_smtp_response: `${errorType}: ${error.message}`
      });
    } catch (logError) {
      console.error('Failed to log delivery error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: userMessage,
        errorType,
        details: error.message,
        provider: 'production_smtp',
        timestamp: new Date().toISOString(),
        supportMessage: 'If this issue persists, please contact support with the timestamp above.'
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});