// supabase/functions/smtp-email-sender/index.ts
// Enhanced SMTP implementation with template support
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Template variable replacement function
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

// Native SMTP client implementation
async function sendSMTPEmail(config: any, emailData: any) {
  const { host, port, auth, secure } = config;
  const { from, to, subject, html, text } = emailData;

  console.log(`=== Connecting to SMTP: ${host}:${port} ===`);

  let conn: Deno.TlsConn | Deno.Conn | null = null;

  try {
    // For secure connections (port 465), we need TLS from the start
    // For port 587, we'll use STARTTLS
    
    if (port === 465) {
      // Direct TLS connection for port 465
      conn = await Deno.connectTls({
        hostname: host,
        port: port,
      });
    } else {
      // Plain connection for port 587 (will upgrade with STARTTLS)
      conn = await Deno.connect({
        hostname: host,
        port: port,
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper to send command and get response
    async function sendCommand(command: string): Promise<string> {
      if (!conn) throw new Error('No connection available');
      
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
    if (port === 587 && secure) {
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

    // Authentication using AUTH PLAIN - use built-in btoa
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

    // Construct and send email content with proper MIME headers
    const messageId = `native-smtp-${Date.now()}@${host}`;
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

    console.log('✅ Email sent successfully via native SMTP');
    
    return {
      messageId,
      accepted: [to],
      rejected: [],
      response: dataResponse
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
    console.error('❌ Native SMTP error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json();
    
    // Support both template-based and direct email formats
    let emailData;
    
    if (requestBody.templateId) {
      // Template-based email
      const { templateId, recipient, variables = {}, emailType = 'transactional' } = requestBody;
      
      if (!templateId || !recipient?.email) {
        throw new Error('Missing required fields: templateId, recipient.email');
      }

      console.log('=== Template-Based Email Request ===');
      console.log('Template ID:', templateId);
      console.log('Recipient:', recipient.email);
      console.log('Variables:', Object.keys(variables));

      // Initialize Supabase client
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

      console.log('✅ Template found:', template.template_name);

      // Get business settings for default variables
      const { data: businessSettings } = await supabaseClient
        .from('business_settings')
        .select('name, email, website_url, primary_color, secondary_color')
        .limit(1)
        .maybeSingle();

      // Merge variables with business settings
      const allVariables = {
        companyName: businessSettings?.name || 'Your Store',
        supportEmail: businessSettings?.email || 'support@example.com',
        websiteUrl: businessSettings?.website_url || 'https://example.com',
        primaryColor: businessSettings?.primary_color || '#3b82f6',
        secondaryColor: businessSettings?.secondary_color || '#1e40af',
        customerName: recipient.name || 'Valued Customer',
        ...variables
      };

      console.log('Processed variables:', Object.keys(allVariables));

      // Process template with variables
      const processedSubject = replaceVariables(template.subject_template, allVariables);
      const processedHtml = replaceVariables(template.html_template, allVariables);
      const processedText = template.text_template 
        ? replaceVariables(template.text_template, allVariables) 
        : processedHtml.replace(/<[^>]*>/g, '');

      emailData = {
        to: recipient.email,
        subject: processedSubject,
        html: processedHtml,
        text: processedText,
        templateId,
        emailType
      };

      console.log('✅ Template processed successfully');

    } else {
      // Direct email format (backward compatibility)
      const { to, subject, html, text } = requestBody;
      
      if (!to || !subject) {
        throw new Error('Missing required fields: to, subject');
      }

      emailData = { to, subject, html, text };
      console.log('=== Direct Email Request ===');
      console.log('To:', to);
      console.log('Subject:', subject);
    }

    // Initialize Supabase client for SMTP settings
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('✅ System function authenticated with service role');

    // Fetch SMTP settings
    console.log('=== Fetching SMTP Settings ===');
    
    const { data: smtpSettings, error: settingsError } = await supabaseClient
      .from('communication_settings')
      .select('*')
      .eq('use_smtp', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    console.log('Settings query error:', settingsError);
    console.log('Settings query result count:', smtpSettings?.length || 0);
    
    if (smtpSettings && smtpSettings.length > 0) {
      const settings = smtpSettings[0];
      console.log('Found SMTP config:', {
        use_smtp: settings.use_smtp,
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        sender: settings.sender_email,
        has_password: !!settings.smtp_pass
      });
    }

    if (settingsError) {
      console.error('Database error:', settingsError);
      throw new Error(`Database error: ${settingsError.message}`);
    }

    if (!smtpSettings || smtpSettings.length === 0) {
      throw new Error('No SMTP configuration found');
    }

    const settings = smtpSettings[0];
    console.log('=== SMTP Settings Loaded ===');
    console.log('Host:', settings.smtp_host);
    console.log('Port:', settings.smtp_port);
    console.log('User:', settings.smtp_user);
    console.log('Secure:', settings.smtp_secure);

    if (!settings.use_smtp) {
      throw new Error('SMTP is disabled in settings');
    }

    // Validate required fields
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass || !settings.sender_email) {
      throw new Error('Incomplete SMTP configuration. Missing: ' + 
        [
          !settings.smtp_host && 'host',
          !settings.smtp_user && 'user', 
          !settings.smtp_pass && 'password',
          !settings.sender_email && 'sender_email'
        ].filter(Boolean).join(', '));
    }

    if (settings.smtp_pass === settings.smtp_user) {
      throw new Error('SMTP password cannot be the same as username');
    }

    // Prepare SMTP configuration
    const smtpConfig = {
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: settings.smtp_secure !== false,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    };

    // Prepare final email data
    const finalEmailData = {
      from: settings.sender_name 
        ? `"${settings.sender_name}" <${settings.sender_email}>`
        : settings.sender_email,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || (emailData.html ? emailData.html.replace(/<[^>]*>/g, '') : ''),
    };

    console.log('=== Sending Email via Native SMTP ===');
    console.log('From:', finalEmailData.from);
    console.log('To:', finalEmailData.to);

    // Send email using native SMTP
    const result = await sendSMTPEmail(smtpConfig, finalEmailData);

    // Log email sending for analytics and delivery confirmation
    try {
      // Log to smtp_delivery_logs
      await supabaseClient.from('smtp_delivery_logs').insert({
        email_id: result.messageId,
        recipient_email: emailData.to,
        subject: emailData.subject,
        delivery_status: 'sent',
        provider: 'smtp',
        smtp_response: result.response,
        email_type: emailData.emailType || 'transactional',
        delivery_timestamp: new Date().toISOString(),
        metadata: {
          messageId: result.messageId,
          method: 'native-smtp',
          timestamp: new Date().toISOString(),
          templateUsed: emailData.templateId || null
        }
      });

      // Log to email_delivery_confirmations for real-time monitoring
      await supabaseClient.from('email_delivery_confirmations').insert({
        email_id: result.messageId,
        recipient_email: emailData.to,
        delivery_status: 'delivered',
        delivery_timestamp: new Date().toISOString(),
        provider_response: {
          messageId: result.messageId,
          response: result.response,
          accepted: result.accepted,
          method: 'native-smtp'
        },
        template_used: emailData.templateId || null,
        email_type: emailData.emailType || 'transactional'
      });

      console.log('📊 Email delivery logged successfully to both tables');
    } catch (logError) {
      console.warn('⚠️ Failed to log email delivery:', logError.message);
    }

    console.log('=== Email Sent Successfully ===');
    console.log('Message ID:', result.messageId);
    console.log('Accepted:', result.accepted);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messageId,
        message: 'Email sent successfully via native SMTP',
        accepted: result.accepted,
        rejected: result.rejected,
        method: 'native-smtp',
        templateUsed: emailData.templateId || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('=== SMTP Email Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString(),
        method: 'native-smtp'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
})