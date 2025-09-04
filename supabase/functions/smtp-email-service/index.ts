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
}

// Response interface
interface EmailResponse {
  status: 'success' | 'error';
  to: string;
  subject: string;
  error?: string;
  messageId?: string;
}

// Validate and load SMTP configuration from environment variables
function loadSMTPConfig(): SMTPConfig {
  const host = Deno.env.get('SMTP_HOST');
  const port = Deno.env.get('SMTP_PORT');
  const username = Deno.env.get('SMTP_USER');
  const password = Deno.env.get('SMTP_PASS');

  const missingVars: string[] = [];
  if (!host) missingVars.push('SMTP_HOST');
  if (!port) missingVars.push('SMTP_PORT');
  if (!username) missingVars.push('SMTP_USER');
  if (!password) missingVars.push('SMTP_PASS');

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const portNumber = parseInt(port!, 10);
  if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
    throw new Error(`Invalid SMTP_PORT: ${port}. Must be a valid port number (1-65535)`);
  }

  // Validate host format (basic hostname validation)
  if (!host!.includes('.') || host!.includes('://')) {
    throw new Error(`Invalid SMTP_HOST: ${host}. Must be a valid hostname (e.g., smtp.gmail.com)`);
  }

  return {
    host: host!,
    port: portNumber,
    username: username!,
    password: password!,
    secure: portNumber === 465 // Use SSL for port 465, STARTTLS for others
  };
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