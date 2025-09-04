import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

// Environment variables validation
interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
}

// Request interface
interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  healthcheck?: boolean; // Add healthcheck flag
}

// Response interface
interface EmailResponse {
  status: 'success' | 'error';
  to: string;
  subject: string;
  error?: string;
  messageId?: string;
}

// Configuration loading and validation with standardized variable names
function loadSMTPConfig(): SMTPConfig {
  const host = Deno.env.get('SMTP_HOST');
  const port = Deno.env.get('SMTP_PORT');
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');

  if (!host || !user || !pass) {
    throw new Error('Missing required SMTP configuration. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  }

  const config: SMTPConfig = {
    host: host.trim(),
    port: port ? parseInt(port.trim(), 10) : 587,
    username: user.trim(),
    password: pass.trim(),
    secure: false // Use STARTTLS
  };

  // Validate port range
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid SMTP_PORT: ${port}. Must be a number between 1-65535.`);
  }

  console.log(`SMTP Config loaded: ${config.host}:${config.port} for ${config.username.replace(/.(?=.{2})/g, '*')}`);
  return config;
}

// SMTP healthcheck function
async function performHealthCheck(config: SMTPConfig): Promise<{ success: boolean; details: string }> {
  console.log('🔍 Performing SMTP health check...');
  
  let connection: Deno.TcpConn | null = null;
  
  try {
    // Test TCP connection with timeout
    const connectPromise = Deno.connect({
      hostname: config.host,
      port: config.port,
      transport: "tcp"
    });
    
    connection = await Promise.race([
      connectPromise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);

    console.log(`✅ Successfully connected to ${config.host}:${config.port}`);

    // Send EHLO and check response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    await connection.write(encoder.encode(`EHLO test\r\n`));
    
    const buffer = new Uint8Array(1024);
    const n = await connection.read(buffer);
    const response = decoder.decode(buffer.subarray(0, n || 0));
    
    if (response.startsWith('220') || response.startsWith('250')) {
      console.log('✅ SMTP server responded successfully to EHLO');
      await connection.write(encoder.encode(`QUIT\r\n`));
      
      return {
        success: true,
        details: `Connected to ${config.host}:${config.port}, EHLO successful`
      };
    } else {
      throw new Error(`Unexpected SMTP response: ${response.substring(0, 100)}`);
    }
    
  } catch (error) {
    console.error('❌ SMTP health check failed:', error.message);
    return {
      success: false,
      details: `Health check failed: ${error.message}`
    };
  } finally {
    if (connection) {
      try {
        connection.close();
      } catch (e) {
        console.warn('Warning: Error closing SMTP connection:', e.message);
      }
    }
  }
}

// Basic SMTP connection and email sending
async function sendEmail(config: SMTPConfig, email: EmailRequest): Promise<string> {
  let conn: Deno.TcpConn | null = null;
  
  try {
    // Connect to SMTP server
    console.log(`🔗 Connecting to SMTP server: ${config.host}:${config.port}`);
    conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Read response helper
    const readResponse = async (): Promise<string> => {
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn!.read(buffer);
      if (!bytesRead) throw new Error('Connection closed unexpectedly');
      return decoder.decode(buffer.subarray(0, bytesRead));
    };

    // Send command helper
    const sendCommand = async (command: string): Promise<string> => {
      console.log(`📤 SMTP: ${command.replace(/PASS \S+/, 'PASS ***')}`);
      await conn!.write(encoder.encode(command + '\r\n'));
      const response = await readResponse();
      console.log(`📥 SMTP: ${response.trim()}`);
      return response;
    };

    // SMTP conversation
    let response = await readResponse(); // Welcome message
    if (!response.startsWith('220')) {
      throw new Error(`SMTP connection failed: ${response.trim()}`);
    }

    // EHLO
    response = await sendCommand(`EHLO ${config.host}`);
    if (!response.startsWith('250')) {
      throw new Error(`EHLO failed: ${response.trim()}`);
    }

    // STARTTLS if not using SSL
    if (!config.secure) {
      response = await sendCommand('STARTTLS');
      if (!response.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${response.trim()}`);
      }
      
      // Note: This is a simplified implementation
      // In production, you'd need proper TLS handshake here
      console.log('⚠️ Warning: TLS upgrade not fully implemented in this basic version');
    }

    // AUTH LOGIN
    response = await sendCommand('AUTH LOGIN');
    if (!response.startsWith('334')) {
      throw new Error(`AUTH LOGIN failed: ${response.trim()}`);
    }

    // Send username (base64 encoded)
    const usernameB64 = btoa(config.username);
    response = await sendCommand(usernameB64);
    if (!response.startsWith('334')) {
      throw new Error(`Authentication username failed: ${response.trim()}`);
    }

    // Send password (base64 encoded)
    const passwordB64 = btoa(config.password);
    response = await sendCommand(passwordB64);
    if (!response.startsWith('235')) {
      throw new Error(`Authentication failed: ${response.trim()}`);
    }

    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${config.username}>`);
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response.trim()}`);
    }

    // RCPT TO
    response = await sendCommand(`RCPT TO:<${email.to}>`);
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response.trim()}`);
    }

    // DATA
    response = await sendCommand('DATA');
    if (!response.startsWith('354')) {
      throw new Error(`DATA command failed: ${response.trim()}`);
    }

    // Email headers and body
    const emailContent = [
      `From: <${config.username}>`,
      `To: <${email.to}>`,
      `Subject: ${email.subject}`,
      'MIME-Version: 1.0',
      email.html ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
      '',
      email.html || email.text || '',
      '.',
    ].join('\r\n');

    await conn.write(encoder.encode(emailContent + '\r\n'));
    response = await readResponse();
    if (!response.startsWith('250')) {
      throw new Error(`Email sending failed: ${response.trim()}`);
    }

    // QUIT
    await sendCommand('QUIT');

    // Extract message ID from response if available
    const messageIdMatch = response.match(/\b([a-zA-Z0-9_-]+@[a-zA-Z0-9_.-]+)\b/);
    const messageId = messageIdMatch ? messageIdMatch[0] : `smtp-${Date.now()}`;

    console.log('✅ Email sent successfully');
    return messageId;

  } catch (error) {
    console.error('❌ SMTP Error:', error.message);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.warn('Connection close error:', e);
      }
    }
  }
}

// Main handler
const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    const errorResponse: EmailResponse = {
      status: 'error',
      to: '',
      subject: '',
      error: 'Method not allowed. Use POST.'
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Load SMTP configuration
    const smtpConfig = loadSMTPConfig();
    console.log(`📧 SMTP Service initialized with host: ${smtpConfig.host}:${smtpConfig.port}`);

    // Parse request body
    let emailRequest: EmailRequest;
    try {
      emailRequest = await req.json();
    } catch (error) {
      const errorResponse: EmailResponse = {
        status: 'error',
        to: '',
        subject: '',
        error: 'Invalid JSON in request body'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle healthcheck requests
    if (emailRequest.healthcheck) {
      console.log('🔍 Healthcheck request received');
      const healthResult = await performHealthCheck(smtpConfig);
      
      return new Response(
        JSON.stringify({
          status: healthResult.success ? 'success' : 'error',
          to: '',
          subject: '',
          error: healthResult.success ? undefined : healthResult.details,
          smtpCheck: {
            configured: true,
            source: 'function_secrets',
            host: smtpConfig.host,
            port: smtpConfig.port,
            details: healthResult.details
          }
        }),
        {
          status: healthResult.success ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate email request
    if (!emailRequest.to || !emailRequest.subject) {
      const errorResponse: EmailResponse = {
        status: 'error',
        to: emailRequest.to || '',
        subject: emailRequest.subject || '',
        error: 'Missing required fields: to, subject'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!emailRequest.html && !emailRequest.text) {
      const errorResponse: EmailResponse = {
        status: 'error',
        to: emailRequest.to,
        subject: emailRequest.subject,
        error: 'Email must contain either html or text content'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRequest.to)) {
      const errorResponse: EmailResponse = {
        status: 'error',
        to: emailRequest.to,
        subject: emailRequest.subject,
        error: 'Invalid email address format'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send email
    console.log(`📬 Sending email to: ${emailRequest.to}, Subject: ${emailRequest.subject}`);
    const messageId = await sendEmail(smtpConfig, emailRequest);

    const successResponse: EmailResponse = {
      status: 'success',
      to: emailRequest.to,
      subject: emailRequest.subject,
      messageId
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 SMTP Service Error:', error.message);
    
    const errorResponse: EmailResponse = {
      status: 'error',
      to: '',
      subject: '',
      error: error.message.includes('Missing required environment variables') 
        ? `Configuration Error: ${error.message}. Please set up SMTP environment variables in Supabase Settings → Edge Functions.`
        : `SMTP Error: ${error.message}`
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);