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

interface SMTPConnection {
  conn: Deno.Conn | Deno.TlsConn;
  encoder: TextEncoder;
  decoder: TextDecoder;
  isTLS: boolean;
}

interface SMTPResponse {
  code: number;
  message: string;
  success: boolean;
}

class SMTPClient {
  private connection: SMTPConnection | null = null;
  private config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    timeout: number;
  };

  constructor(host: string, port: number, user: string, pass: string, secure: boolean = false) {
    this.config = {
      host,
      port,
      user,
      pass,
      secure,
      timeout: 30000 // 30 seconds timeout
    };
  }

  private async readResponse(expectMultiline: boolean = false): Promise<SMTPResponse> {
    if (!this.connection) throw new Error('No connection established');
    
    let response = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const buffer = new Uint8Array(4096);
        
        // Add a small delay for TLS connections to ensure data is ready
        if (this.connection.isTLS && attempts === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Response timeout')), 10000);
        });
        
        const readPromise = this.connection.conn.read(buffer);
        const bytesRead = await Promise.race([readPromise, timeoutPromise]);
        
        if (bytesRead === null) {
          throw new Error('Connection closed unexpectedly');
        }
        
        if (bytesRead > 0) {
          const chunk = this.connection.decoder.decode(buffer.subarray(0, bytesRead));
          response += chunk;
          
          // Check if we have a complete response
          if (response.includes('\n')) {
            const lines = response.split('\n');
            const lastLine = lines[lines.length - 2] || lines[lines.length - 1]; // Handle trailing newline
            
            if (lastLine && lastLine.length >= 4) {
              const hasMoreLines = lastLine.charAt(3) === '-';
              if (!hasMoreLines || !expectMultiline) {
                break;
              }
            }
          }
        }
        
        attempts++;
        if (attempts < maxAttempts && response.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay before retry
        }
      } catch (error) {
        if (error.message === 'Response timeout') {
          throw error;
        }
        throw new Error(`Failed to read response: ${error.message}`);
      }
    }

    if (response.length === 0) {
      throw new Error('No response received from server');
    }

    console.log('SMTP Response:', response.trim());
    
    const lines = response.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();
    
    if (lastLine.length < 3) {
      throw new Error('Invalid SMTP response format');
    }
    
    const code = parseInt(lastLine.substring(0, 3));
    const message = lastLine.substring(4) || lastLine.substring(3);
    
    return {
      code,
      message,
      success: code >= 200 && code < 400
    };
  }

  private async sendCommand(command: string, expectMultiline: boolean = false): Promise<SMTPResponse> {
    if (!this.connection) throw new Error('No connection established');
    
    console.log('SMTP Command:', command);
    
    try {
      const encodedCommand = this.connection.encoder.encode(command + '\r\n');
      await this.connection.conn.write(encodedCommand);
      
      // Add a small delay after sending command, especially for TLS connections
      if (this.connection.isTLS) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      return await this.readResponse(expectMultiline);
    } catch (error) {
      throw new Error(`Failed to send command "${command}": ${error.message}`);
    }
  }

  private async connectWithTimeout(options: Deno.ConnectOptions | Deno.ConnectTlsOptions, useTLS: boolean = false): Promise<Deno.Conn | Deno.TlsConn> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after ${this.config.timeout}ms`)), this.config.timeout);
    });

    try {
      if (useTLS) {
        const connectPromise = Deno.connectTls(options as Deno.ConnectTlsOptions);
        return await Promise.race([connectPromise, timeoutPromise]);
      } else {
        const connectPromise = Deno.connect(options as Deno.ConnectOptions);
        return await Promise.race([connectPromise, timeoutPromise]);
      }
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  private async establishConnection(): Promise<void> {
    const attempts = [
      // Attempt 1: Direct TLS connection (port 465)
      async () => {
        if (this.config.port === 465 || this.config.secure) {
          console.log('Attempting direct TLS connection...');
          const conn = await this.connectWithTimeout({
            hostname: this.config.host,
            port: this.config.port,
          }, true);
          
          this.connection = {
            conn,
            encoder: new TextEncoder(),
            decoder: new TextDecoder(),
            isTLS: true
          };
          
          const response = await this.readResponse();
          if (!response.success) {
            throw new Error(`SMTP server rejected connection: ${response.message}`);
          }
          return true;
        }
        return false;
      },
      
      // Attempt 2: Plain connection with STARTTLS upgrade (port 587)
      async () => {
        console.log('Attempting plain connection with STARTTLS...');
        let conn = await this.connectWithTimeout({
          hostname: this.config.host,
          port: this.config.port,
        }, false);
        
        this.connection = {
          conn,
          encoder: new TextEncoder(),
          decoder: new TextDecoder(),
          isTLS: false
        };
        
        // Read initial greeting
        const greeting = await this.readResponse();
        if (!greeting.success) {
          throw new Error(`SMTP server rejected connection: ${greeting.message}`);
        }
        
        // Send EHLO
        const ehlo = await this.sendCommand(`EHLO ${this.config.host}`);
        if (!ehlo.success) {
          throw new Error(`EHLO failed: ${ehlo.message}`);
        }
        
        // Check if STARTTLS is supported
        if (ehlo.message.includes('STARTTLS') || this.config.port === 587) {
          const starttls = await this.sendCommand('STARTTLS');
          if (starttls.success) {
            // Upgrade to TLS
            console.log('Upgrading to TLS...');
            try {
              const tlsConn = await Deno.startTls(conn, {
                hostname: this.config.host,
              });
              
              this.connection.conn = tlsConn;
              this.connection.isTLS = true;
              
              // Send EHLO again after TLS upgrade
              const ehloTls = await this.sendCommand(`EHLO ${this.config.host}`);
              if (!ehloTls.success) {
                throw new Error(`EHLO after STARTTLS failed: ${ehloTls.message}`);
              }
              
              return true;
            } catch (tlsError) {
              console.error('TLS upgrade failed:', tlsError);
              throw new Error(`TLS upgrade failed: ${tlsError.message}`);
            }
          }
        }
        
        return true; // Continue without TLS if STARTTLS not available
      },
      
      // Attempt 3: Plain connection without TLS (fallback)
      async () => {
        console.log('Attempting plain connection without TLS (fallback)...');
        const conn = await this.connectWithTimeout({
          hostname: this.config.host,
          port: this.config.port,
        }, false);
        
        this.connection = {
          conn,
          encoder: new TextEncoder(),
          decoder: new TextDecoder(),
          isTLS: false
        };
        
        const response = await this.readResponse();
        if (!response.success) {
          throw new Error(`SMTP server rejected connection: ${response.message}`);
        }
        
        return true;
      }
    ];

    let lastError: Error | null = null;
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        const success = await attempts[i]();
        if (success) {
          console.log(`Connection established using method ${i + 1}`);
          return;
        }
      } catch (error) {
        console.error(`Connection attempt ${i + 1} failed:`, error.message);
        lastError = error;
        
        // Clean up failed connection
        if (this.connection?.conn) {
          try {
            this.connection.conn.close();
          } catch {}
          this.connection = null;
        }
      }
    }
    
    throw new Error(`All connection attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  async connect(): Promise<void> {
    try {
      await this.establishConnection();
    } catch (error) {
      if (this.connection?.conn) {
        try {
          this.connection.conn.close();
        } catch {}
      }
      throw error;
    }
  }

  async authenticate(): Promise<void> {
    if (!this.connection) throw new Error('No connection established');
    
    // Try AUTH LOGIN
    try {
      const authLogin = await this.sendCommand('AUTH LOGIN');
      if (authLogin.success) {
        const encodedUser = btoa(this.config.user);
        const userResponse = await this.sendCommand(encodedUser);
        if (!userResponse.success) {
          throw new Error(`Username authentication failed: ${userResponse.message}`);
        }
        
        const encodedPass = btoa(this.config.pass);
        const passResponse = await this.sendCommand(encodedPass);
        if (!passResponse.success) {
          throw new Error(`Password authentication failed: ${passResponse.message}`);
        }
        
        return;
      }
    } catch (error) {
      console.error('AUTH LOGIN failed:', error.message);
    }
    
    // Try AUTH PLAIN as fallback
    try {
      const authString = btoa(`\0${this.config.user}\0${this.config.pass}`);
      const authPlain = await this.sendCommand(`AUTH PLAIN ${authString}`);
      if (!authPlain.success) {
        throw new Error(`PLAIN authentication failed: ${authPlain.message}`);
      }
    } catch (error) {
      throw new Error(`All authentication methods failed: ${error.message}`);
    }
  }

  async sendEmail(emailData: EmailRequest): Promise<void> {
    if (!this.connection) throw new Error('No connection established');
    
    const fromEmail = emailData.from || this.config.user;
    
    // MAIL FROM
    const mailFrom = await this.sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (!mailFrom.success) {
      throw new Error(`MAIL FROM failed: ${mailFrom.message}`);
    }
    
    // RCPT TO
    const rcptTo = await this.sendCommand(`RCPT TO:<${emailData.to}>`);
    if (!rcptTo.success) {
      throw new Error(`RCPT TO failed: ${rcptTo.message}`);
    }
    
    // DATA
    const dataCmd = await this.sendCommand('DATA');
    if (!dataCmd.success) {
      throw new Error(`DATA command failed: ${dataCmd.message}`);
    }
    
    // Email content
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
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
      ``,
      `.`
    ].join('\r\n');
    
    await this.connection.conn.write(this.connection.encoder.encode(emailMessage + '\r\n'));
    const dataResponse = await this.readResponse();
    if (!dataResponse.success) {
      throw new Error(`Email data rejected: ${dataResponse.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.sendCommand('QUIT');
      } catch (error) {
        console.error('Error sending QUIT:', error);
      }
      
      try {
        this.connection.conn.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
      
      this.connection = null;
    }
  }
}

// Debug SMTP connection function
async function debugSMTPConnection(hostname: string, port: number) {
  try {
    console.log(`🔍 Testing raw TCP connection to ${hostname}:${port}...`);
    const conn = await Deno.connect({ hostname, port });
    console.log(`✅ TCP connection to ${hostname}:${port} successful`);
    
    // Read initial server greeting
    const buffer = new Uint8Array(1024);
    const bytesRead = await conn.read(buffer);
    const greeting = new TextDecoder().decode(buffer.subarray(0, bytesRead || 0));
    console.log(`📨 Server greeting: ${greeting.trim()}`);
    
    conn.close();
    return greeting;
  } catch (error) {
    console.error(`❌ TCP connection failed to ${hostname}:${port}: ${error.message}`);
    return null;
  }
}

// Test function to find working SMTP host
async function findWorkingSMTPHost(baseHostname: string) {
  const alternatives = [
    baseHostname, // original
    `mail.${baseHostname.replace('smtp.', '')}`,
    baseHostname.replace('smtp.', ''),
    `outbound.${baseHostname.replace('smtp.', '')}`
  ];

  for (const hostname of alternatives) {
    console.log(`🔍 Testing ${hostname}:587...`);
    const result = await debugSMTPConnection(hostname, 587);
    if (result && result.includes("220")) {
      console.log(`✅ Found working SMTP server: ${hostname}`);
      return hostname;
    }
    
    // Also test port 465 for SSL
    console.log(`🔍 Testing ${hostname}:465...`);
    const sslResult = await debugSMTPConnection(hostname, 465);
    if (sslResult && sslResult.includes("220")) {
      console.log(`✅ Found working SMTP server: ${hostname}:465`);
      return { hostname, port: 465, secure: true };
    }
  }
  
  console.log("❌ No working SMTP server found in alternatives");
  return null;
}

async function sendSMTPEmail(emailData: EmailRequest) {
  let smtpHost = Deno.env.get('SMTP_HOST');
  let smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPass = Deno.env.get('SMTP_PASS');
  let smtpSecure = Deno.env.get('SMTP_SECURE') === 'true';

  // Validate SMTP configuration
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('Missing SMTP configuration. Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  console.log(`=== Enhanced SMTP Debug Session ===`);
  console.log(`Target: ${smtpHost}:${smtpPort} (${smtpSecure ? 'SSL' : 'STARTTLS'})`);
  
  // First, debug the connection
  const greeting = await debugSMTPConnection(smtpHost, smtpPort);
  if (!greeting || !greeting.includes("220")) {
    console.log(`⚠️ Initial connection test failed, trying alternatives...`);
    const alternative = await findWorkingSMTPHost(smtpHost);
    if (!alternative) {
      
      // Provide specific troubleshooting based on error type
      console.error("💡 SMTP Server Connection Failed - Troubleshooting Guide:");
      console.error("   - Check if smtp.yournotify.com is the correct SMTP hostname");
      console.error("   - Try alternative hostnames like mail.yournotify.com or yournotify.com");
      console.error("   - Verify port 587 is correct (some providers use 465 or 25)");
      console.error("   - Test with known working providers:");
      console.error("     • Gmail: smtp.gmail.com:587 (use App Password)");
      console.error("     • Outlook: smtp-mail.outlook.com:587");
      
      throw new Error(`SMTP server not responding correctly. Tested ${smtpHost} and alternatives. Check if the hostname and port are correct.`);
    }
    
    if (typeof alternative === 'object') {
      smtpHost = alternative.hostname;
      smtpPort = alternative.port;
      smtpSecure = alternative.secure;
    } else {
      smtpHost = alternative;
    }
    
    console.log(`🔄 Switching to working server: ${smtpHost}:${smtpPort}`);
  }

  console.log(`Attempting to send email via ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);
  
  const client = new SMTPClient(smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure);
  
  try {
    console.log('Connecting to SMTP server...');
    await client.connect();
    
    console.log('Authenticating...');
    await client.authenticate();
    
    console.log('Sending email...');
    await client.sendEmail(emailData);
    
    console.log('Email sent successfully');
    return { success: true, message: 'Email sent successfully' };
    
  } catch (error) {
    console.error('SMTP Error:', error);
    throw new Error(`SMTP sending failed: ${error.message}`);
  } finally {
    try {
      await client.disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting:', disconnectError);
    }
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