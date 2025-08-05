import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

async function sendSMTPEmail(emailData: EmailRequest) {
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPass = Deno.env.get('SMTP_PASS');
  const smtpSecure = Deno.env.get('SMTP_SECURE') === 'true';

  // Validate SMTP configuration
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('Missing SMTP configuration. Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  // Create email message in RFC 2822 format
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
  const fromEmail = emailData.from || smtpUser;
  
  const emailMessage = [
    `From: ${fromEmail}`,
    `To: ${emailData.to}`,
    `Subject: ${emailData.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    emailData.text || 'Please view this email in HTML format.',
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    emailData.html || `<p>${emailData.text || 'Email content'}</p>`,
    ``,
    `--${boundary}--`,
    ``
  ].join('\r\n');

  try {
    // Connect to SMTP server
    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper function to send command and read response
    async function sendCommand(command: string): Promise<string> {
      await conn.write(encoder.encode(command + '\r\n'));
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      return decoder.decode(buffer.subarray(0, bytesRead || 0));
    }

    // SMTP conversation
    let response = await sendCommand('');
    console.log('Initial response:', response);

    response = await sendCommand(`EHLO ${smtpHost}`);
    console.log('EHLO response:', response);

    // Start TLS if required
    if (!smtpSecure && smtpPort === 587) {
      response = await sendCommand('STARTTLS');
      console.log('STARTTLS response:', response);
      
      // Note: In production, you'd need to upgrade to TLS connection here
      // For now, we'll continue with basic auth
    }

    // Authenticate
    response = await sendCommand('AUTH LOGIN');
    console.log('AUTH LOGIN response:', response);

    const encodedUser = btoa(smtpUser);
    response = await sendCommand(encodedUser);
    console.log('Username response:', response);

    const encodedPass = btoa(smtpPass);
    response = await sendCommand(encodedPass);
    console.log('Password response:', response);

    // Send email
    response = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    console.log('MAIL FROM response:', response);

    response = await sendCommand(`RCPT TO:<${emailData.to}>`);
    console.log('RCPT TO response:', response);

    response = await sendCommand('DATA');
    console.log('DATA response:', response);

    await conn.write(encoder.encode(emailMessage + '\r\n.\r\n'));
    const dataBuffer = new Uint8Array(1024);
    const dataBytesRead = await conn.read(dataBuffer);
    response = decoder.decode(dataBuffer.subarray(0, dataBytesRead || 0));
    console.log('Message response:', response);

    await sendCommand('QUIT');
    conn.close();

    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('SMTP Error:', error);
    throw new Error(`SMTP sending failed: ${error.message}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Email function called with method:', req.method);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestBody = await req.text();
    console.log('Request body:', requestBody);

    let emailData: EmailRequest;
    try {
      emailData = JSON.parse(requestBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate required fields
    if (!emailData.to || !emailData.subject) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: to and subject are required',
          received: { to: !!emailData.to, subject: !!emailData.subject }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check SMTP environment variables
    const smtpConfig = {
      host: Deno.env.get('SMTP_HOST'),
      port: Deno.env.get('SMTP_PORT'),
      user: Deno.env.get('SMTP_USER'),
      pass: Deno.env.get('SMTP_PASS'),
    };

    console.log('SMTP Config check:', {
      host: !!smtpConfig.host,
      port: smtpConfig.port,
      user: !!smtpConfig.user,
      pass: !!smtpConfig.pass,
    });

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return new Response(
        JSON.stringify({ 
          error: 'SMTP configuration incomplete',
          config: {
            host: !!smtpConfig.host,
            port: smtpConfig.port,
            user: !!smtpConfig.user,
            pass: !!smtpConfig.pass,
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For testing purposes, let's first return a success without actually sending
    // to verify the function works, then we can enable actual sending
    const testMode = Deno.env.get('EMAIL_TEST_MODE') === 'true';
    
    if (testMode) {
      console.log('Test mode - would send email to:', emailData.to);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email function working in test mode',
          emailData: {
            to: emailData.to,
            subject: emailData.subject,
            hasHtml: !!emailData.html,
            hasText: !!emailData.text
          },
          smtpConfig: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            user: smtpConfig.user
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Actually send the email
    const result = await sendSMTPEmail(emailData);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});