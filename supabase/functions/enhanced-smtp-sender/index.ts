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
async function sendSMTPEmail(config: any, emailData: any, timeoutMs: number = 15000) {
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
      timeoutId = setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms to ${host}:${port}`)), timeoutMs);
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
      const buffer = new Uint8Array(2048);
      const readPromise = conn.read(buffer);
      const responseTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Response timeout')), 10000);
      });
      
      const bytesRead = await Promise.race([readPromise, responseTimeout]) as number | null;
      
      if (bytesRead === null) {
        throw new Error('Connection closed unexpectedly');
      }
      
      const response = decoder.decode(buffer.slice(0, bytesRead)).trim();
      console.log(`SMTP < ${response}`);
      
      return response;
    }

    // Read initial greeting
    const buffer = new Uint8Array(2048);
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
      console.log('🔐 Initiating STARTTLS...');
      response = await sendCommand('STARTTLS');
      if (!response.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${response}`);
      }
      
      // Close current connection and create TLS connection
      conn.close();
      
      console.log('🔄 Upgrading to TLS connection...');
      conn = await Deno.connectTls({ hostname: host, port: port });
      
      // Send EHLO again after TLS upgrade
      response = await sendCommand(`EHLO ${host}`);
      if (!response.startsWith('250')) {
        throw new Error(`EHLO after STARTTLS failed: ${response}`);
      }
    }

    // Authentication
    if (auth && auth.user && auth.pass) {
      console.log('🔑 Authenticating...');
      response = await sendCommand('AUTH LOGIN');
      if (!response.startsWith('334')) {
        throw new Error(`AUTH LOGIN failed: ${response}`);
      }

      // Send username
      const username = btoa(auth.user);
      response = await sendCommand(username);
      if (!response.startsWith('334')) {
        throw new Error(`Username authentication failed: ${response}`);
      }

      // Send password
      const password = btoa(auth.pass);
      response = await sendCommand(password);
      if (!response.startsWith('235')) {
        throw new Error(`Password authentication failed: ${response}`);
      }
    }

    // Send email
    console.log('📧 Sending email...');
    
    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${from}>`);
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response}`);
    }

    // RCPT TO
    response = await sendCommand(`RCPT TO:<${to}>`);
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response}`);
    }

    // DATA
    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      throw new Error(`DATA command failed: ${response}`);
    }

    // Email content
    const emailContent = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html || text || 'Test email content',
      '.'
    ].join('\r\n');

    response = await sendCommand(emailContent);
    if (!response.startsWith('250')) {
      throw new Error(`Email sending failed: ${response}`);
    }

    // QUIT
    await sendCommand('QUIT');
    
    console.log('✅ Email sent successfully!');
    return { success: true, messageId: response };

  } catch (error) {
    console.error(`❌ SMTP Error on ${host}:${port}:`, error.message);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.warn('Error closing connection:', e.message);
      }
    }
  }
}

serve(async (req) => {
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData = await req.json();
    console.log('📨 Enhanced SMTP sender request:', { 
      to: requestData.to,
      subject: requestData.subject,
      templateId: requestData.templateId 
    });

    let emailData = requestData;
    
    // Handle template-based emails
    if (requestData.templateId) {
      const { data: template } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', requestData.templateId)
        .eq('is_active', true)
        .single();

      if (template) {
        // Replace variables in template
        const variables = requestData.variables || {};
        emailData = {
          ...requestData,
          subject: template.subject.replace(/{{(\w+)}}/g, (_, key) => variables[key] || ''),
          html: template.html_template.replace(/{{(\w+)}}/g, (_, key) => variables[key] || ''),
          text: template.text_template?.replace(/{{(\w+)}}/g, (_, key) => variables[key] || '') || ''
        };
      }
    }

    // Get SMTP configuration with fallback
    const { data: configData, error: configError } = await supabase.rpc('get_smtp_config_with_fallback');
    
    if (configError) {
      throw new Error(`Failed to get SMTP config: ${configError.message}`);
    }

    // Send email with fallback strategy
    const result = await sendSMTPEmailWithFallback(configData, {
      from: emailData.from || configData.primary.auth.user,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    });

    // Log successful delivery
    await supabase.from('smtp_delivery_logs').insert({
      provider: 'enhanced-smtp',
      status: 'sent',
      recipient_email: emailData.to,
      subject: emailData.subject,
      response_data: result,
      delivery_time: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully via enhanced SMTP',
        result: result
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Enhanced SMTP sender error:', error);
    
    // Log failed delivery
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const requestData = await req.json().catch(() => ({}));
      
      await supabase.from('smtp_delivery_logs').insert({
        provider: 'enhanced-smtp',
        status: 'failed',
        recipient_email: requestData.to || 'unknown',
        subject: requestData.subject || 'unknown',
        error_message: error.message,
        delivery_time: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log delivery error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Enhanced SMTP sender failed - check logs for more details'
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});