// Enhanced SMTP Email Sender with Port Fallback and Connection Optimization
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced SMTP client with fallback ports and retry logic
async function sendSMTPEmailWithFallback(config: any, emailData: any) {
  const { primary, fallback, timeout, retry_attempts } = config;
  const attempts = [primary, fallback];
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retry_attempts; attempt++) {
    for (const smtpConfig of attempts) {
      try {
        console.log(`🔄 Attempt ${attempt + 1}: Trying ${smtpConfig.host}:${smtpConfig.port} (${smtpConfig.secure ? 'SSL' : 'STARTTLS'})`);
        
        const result = await sendSMTPEmail(smtpConfig, emailData, timeout);
        console.log(`✅ Success on ${smtpConfig.host}:${smtpConfig.port}`);
        
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`❌ Failed ${smtpConfig.host}:${smtpConfig.port}: ${error.message}`);
        
        // Wait before next attempt (exponential backoff)
        if (attempt < retry_attempts - 1 || smtpConfig !== attempts[attempts.length - 1]) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }
  
  throw lastError || new Error('All SMTP connection attempts failed');
}

// Enhanced SMTP implementation with timeout handling
async function sendSMTPEmail(config: any, emailData: any, timeoutMs: number = 30000) {
  const { host, port, auth, secure } = config;
  const { from, to, subject, html, text } = emailData;

  console.log(`=== SMTP Connection: ${host}:${port} (${secure ? 'SSL' : 'STARTTLS'}) ===`);

  let conn: Deno.TlsConn | Deno.Conn | null = null;
  let timeoutId: number | null = null;

  try {
    // Create connection with timeout
    const connectPromise = secure 
      ? Deno.connectTls({ hostname: host, port: port })
      : Deno.connect({ hostname: host, port: port });
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    conn = await Promise.race([connectPromise, timeoutPromise]) as Deno.TlsConn | Deno.Conn;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper to send command with timeout
    async function sendCommand(command: string): Promise<string> {
      if (!conn) throw new Error('No connection available');
      
      const cmdToLog = command.startsWith('AUTH PLAIN') || command.includes('PASS') 
        ? command.replace(/PASS .+/, 'PASS ***').replace(/AUTH PLAIN .+/, 'AUTH PLAIN ***')
        : command;
      
      console.log(`SMTP > ${cmdToLog}`);
      
      await conn.write(encoder.encode(command + '\r\n'));
      
      // Read response with timeout
      const buffer = new Uint8Array(1024);
      const readPromise = conn.read(buffer);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Response timeout')), 10000);
      });
      
      const bytesRead = await Promise.race([readPromise, timeoutPromise]) as number | null;
      
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

    // STARTTLS for non-secure connections (port 587)
    if (!secure && port === 587) {
      response = await sendCommand('STARTTLS');
      if (!response.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${response}`);
      }
      
      // Close current connection and create TLS connection
      conn.close();
      
      conn = await Deno.connectTls({
        hostname: host,
        port: port,
      });
      
      // Send EHLO again after TLS
      response = await sendCommand(`EHLO ${host}`);
      if (!response.startsWith('250')) {
        throw new Error(`EHLO after STARTTLS failed: ${response}`);
      }
    }

    // Authentication using AUTH PLAIN
    const authString = btoa(`\0${auth.user}\0${auth.pass}`);
    response = await sendCommand(`AUTH PLAIN ${authString}`);
    
    if (!response.startsWith('235')) {
      throw new Error(`Authentication failed: ${response}`);
    }

    // Send MAIL FROM
    const fromEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] || from : from;
    response = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response}`);
    }

    // Send RCPT TO
    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response}`);
    }

    // Send DATA
    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      throw new Error(`DATA failed: ${response}`);
    }

    // Construct and send email content
    const messageId = `enhanced-smtp-${Date.now()}@${host}`;
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

    // Send QUIT
    await sendCommand('QUIT');
    conn.close();
    conn = null;

    console.log('✅ Email sent successfully via enhanced SMTP');
    
    return {
      messageId,
      accepted: [to],
      rejected: [],
      response: dataResponse,
      port: port,
      method: secure ? 'SSL' : 'STARTTLS'
    };

  } catch (error) {
    // Ensure connection is closed on error
    if (conn) {
      try {
        conn.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    console.error(`❌ Enhanced SMTP error (${host}:${port}):`, error.message);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json();
    console.log('=== Enhanced SMTP Email Request ===');
    
    // Support both template-based and direct email formats
    let emailData;
    
    if (requestBody.templateId) {
      // Template-based email processing
      const { templateId, recipient, variables = {}, emailType = 'transactional' } = requestBody;
      
      if (!templateId || !recipient?.email) {
        throw new Error('Missing required fields: templateId, recipient.email');
      }

      console.log('Processing template-based email:', templateId);

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      // Fetch email template
      const { data: template, error: templateError } = await supabaseClient
        .from('enhanced_email_templates')
        .select('*')
        .eq('template_key', templateId)
        .eq('is_active', true)
        .maybeSingle();

      if (templateError) {
        throw new Error(`Template fetch error: ${templateError.message}`);
      }

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Get business settings
      const { data: businessSettings } = await supabaseClient
        .from('business_settings')
        .select('name, email, website_url, primary_color, secondary_color')
        .limit(1)
        .maybeSingle();

      // Process template variables
      const allVariables = {
        companyName: businessSettings?.name || 'Starters',
        supportEmail: businessSettings?.email || 'support@starters.com',
        websiteUrl: businessSettings?.website_url || 'https://starters.com',
        primaryColor: businessSettings?.primary_color || '#3b82f6',
        secondaryColor: businessSettings?.secondary_color || '#1e40af',
        customerName: recipient.name || 'Valued Customer',
        ...variables
      };

      // Replace template variables
      function replaceVariables(template: string, variables: Record<string, string>): string {
        let result = template;
        Object.entries(variables).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          result = result.replace(regex, value || '');
        });
        return result;
      }

      const processedSubject = replaceVariables(template.subject_template, allVariables);
      const processedHtml = replaceVariables(template.html_template, allVariables);

      emailData = {
        to: recipient.email,
        subject: processedSubject,
        html: processedHtml,
        templateId,
        emailType
      };

    } else {
      // Direct email format
      const { to, subject, html, text } = requestBody;
      
      if (!to || !subject) {
        throw new Error('Missing required fields: to, subject');
      }

      emailData = { to, subject, html, text };
    }

    // Get enhanced SMTP configuration with fallback
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('=== Fetching Enhanced SMTP Configuration ===');
    
    const { data: smtpResult, error: funcError } = await supabaseClient
      .rpc('get_smtp_config_with_fallback');

    if (funcError) {
      throw new Error(`SMTP config error: ${funcError.message}`);
    }

    if (!smtpResult) {
      throw new Error('No SMTP configuration found');
    }

    const smtpConfig = smtpResult;
    console.log('✅ Enhanced SMTP config loaded:', {
      primary: `${smtpConfig.primary.host}:${smtpConfig.primary.port}`,
      fallback: `${smtpConfig.fallback.host}:${smtpConfig.fallback.port}`
    });

    // Prepare email data with sender information
    const finalEmailData = {
      from: smtpConfig.primary.sender_name 
        ? `"${smtpConfig.primary.sender_name}" <${smtpConfig.primary.sender_email}>`
        : smtpConfig.primary.sender_email,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || (emailData.html ? emailData.html.replace(/<[^>]*>/g, '') : ''),
    };

    console.log('=== Sending Email via Enhanced SMTP ===');
    console.log('From:', finalEmailData.from);
    console.log('To:', finalEmailData.to);

    // Send email using enhanced SMTP with fallback
    const result = await sendSMTPEmailWithFallback(smtpConfig, finalEmailData);

    // Log successful delivery
    try {
      await supabaseClient.from('smtp_delivery_logs').insert({
        email_id: result.messageId,
        recipient_email: emailData.to,
        subject: emailData.subject,
        delivery_status: 'sent',
        provider: 'enhanced-smtp',
        smtp_response: result.response,
        email_type: emailData.emailType || 'transactional',
        delivery_timestamp: new Date().toISOString(),
        metadata: {
          messageId: result.messageId,
          method: result.method,
          port: result.port,
          timestamp: new Date().toISOString(),
          templateUsed: emailData.templateId || null
        }
      });
      console.log('📊 Email delivery logged successfully');
    } catch (logError) {
      console.warn('⚠️ Failed to log email delivery:', logError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messageId,
        message: 'Email sent successfully via enhanced SMTP',
        accepted: result.accepted,
        rejected: result.rejected,
        method: result.method,
        port: result.port,
        templateUsed: emailData.templateId || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('=== Enhanced SMTP Email Error ===');
    console.error('Error message:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString(),
        method: 'enhanced-smtp'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
})