import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Hardened Native SMTP implementation with enhanced error handling
class NativeSMTPClient {
  private hostname: string;
  private port: number;
  private username: string;
  private password: string;
  private conn: Deno.TcpConn | Deno.TlsConn | null = null;
  private debug: boolean;
  private authMethods: string[] = [];

  constructor(config: {
    hostname: string;
    port: number;
    username: string;
    password: string;
    debug?: boolean;
  }) {
    this.hostname = config.hostname;
    this.port = config.port;
    this.username = config.username;
    this.password = config.password;
    this.debug = config.debug || false;
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[SMTP Debug] ${message}`);
    }
  }

  private async readResponse(): Promise<string> {
    if (!this.conn) throw new Error('No connection');
    
    let fullResponse = '';
    let buffer = new Uint8Array(4096);
    
    while (true) {
      const n = await this.conn.read(buffer);
      if (n === null) throw new Error('Connection closed unexpectedly');
      
      const chunk = new TextDecoder().decode(buffer.subarray(0, n));
      fullResponse += chunk;
      
      // Check if we have complete lines ending with \r\n
      const lines = fullResponse.split('\r\n');
      
      // Multi-line responses: continue reading if last complete line has format "250-..." 
      const lastCompleteLine = lines[lines.length - 2]; // -2 because last element is empty after split
      if (lastCompleteLine && /^\d{3}-/.test(lastCompleteLine)) {
        continue; // Multi-line response, keep reading
      }
      
      // Single line or final line of multi-line response
      if (lastCompleteLine && /^\d{3}\s/.test(lastCompleteLine)) {
        break; // Complete response received
      }
      
      // If response doesn't end properly, continue reading
      if (!fullResponse.endsWith('\r\n')) {
        continue;
      }
      
      break;
    }
    
    this.log(`SMTP Response: ${fullResponse.trim()}`);
    return fullResponse;
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error('No connection');
    
    this.log(`SMTP Command: ${command.trim()}`);
    const encoder = new TextEncoder();
    await this.conn.write(encoder.encode(command + '\r\n'));
    return await this.readResponse();
  }

  private base64Encode(str: string): string {
    return btoa(str);
  }

  private parseEhloCapabilities(ehloResponse: string): void {
    const lines = ehloResponse.split('\r\n');
    this.authMethods = [];
    
    for (const line of lines) {
      if (line.includes('AUTH')) {
        const authLine = line.replace(/^250[-\s]/, '');
        if (authLine.startsWith('AUTH')) {
          this.authMethods = authLine.substring(4).trim().split(/\s+/);
          this.log(`AUTH methods supported: ${this.authMethods.join(', ')}`);
        }
      }
    }
  }

  private async authenticateWithBestMethod(): Promise<void> {
    // Try LOGIN first (most common), then PLAIN as fallback
    if (this.authMethods.includes('LOGIN') || this.authMethods.length === 0) {
      await this.authenticateLogin();
    } else if (this.authMethods.includes('PLAIN')) {
      await this.authenticatePlain();
    } else {
      throw new Error(`No supported AUTH methods. Server supports: ${this.authMethods.join(', ')}`);
    }
  }

  private async authenticateLogin(): Promise<void> {
    this.log('Trying AUTH LOGIN...');
    
    const authResponse = await this.sendCommand('AUTH LOGIN');
    if (!authResponse.startsWith('334')) {
      throw new Error(`AUTH LOGIN not accepted: ${authResponse}`);
    }

    // Send base64 encoded username
    const usernameResponse = await this.sendCommand(this.base64Encode(this.username));
    if (!usernameResponse.startsWith('334')) {
      throw new Error(`Username rejected: ${usernameResponse}`);
    }

    // Send base64 encoded password
    const passwordResponse = await this.sendCommand(this.base64Encode(this.password));
    if (!passwordResponse.startsWith('235')) {
      throw new Error(`Authentication failed: ${passwordResponse}`);
    }

    this.log('AUTH LOGIN successful');
  }

  private async authenticatePlain(): Promise<void> {
    this.log('Trying AUTH PLAIN...');
    
    const authString = `\0${this.username}\0${this.password}`;
    const authResponse = await this.sendCommand(`AUTH PLAIN ${this.base64Encode(authString)}`);
    
    if (!authResponse.startsWith('235')) {
      throw new Error(`AUTH PLAIN failed: ${authResponse}`);
    }

    this.log('AUTH PLAIN successful');
  }

  async connect(): Promise<void> {
    console.log(`🔌 Connecting to ${this.hostname}:${this.port}${this.debug ? ' (debug mode)' : ''}`);
    
    try {
      // Connect via TCP
      this.conn = await Deno.connect({
        hostname: this.hostname,
        port: this.port,
      });

      // Read initial greeting
      const greeting = await this.readResponse();
      if (!greeting.startsWith('220')) {
        throw new Error(`SMTP server rejected connection: ${greeting}`);
      }

      // Send EHLO and parse capabilities
      const ehloResponse = await this.sendCommand(`EHLO ${this.hostname}`);
      if (!ehloResponse.startsWith('250')) {
        throw new Error(`EHLO failed: ${ehloResponse}`);
      }
      
      this.parseEhloCapabilities(ehloResponse);

      // Handle TLS based on port
      if (this.port === 587) {
        console.log('🔐 Starting TLS on port 587...');
        await this.startTLS();
      } else if (this.port === 465) {
        console.log('🔐 Upgrading to TLS on port 465...');
        await this.upgradeTo465TLS();
      }

      // Authenticate using best available method
      console.log('🔑 Authenticating...');
      await this.authenticateWithBestMethod();
      console.log('✅ SMTP connection and authentication successful');

    } catch (error) {
      if (this.conn) {
        this.conn.close();
        this.conn = null;
      }
      throw new Error(`SMTP connection failed: ${error.message}`);
    }
  }

  private async startTLS(): Promise<void> {
    const startTlsResponse = await this.sendCommand('STARTTLS');
    if (!startTlsResponse.startsWith('220')) {
      throw new Error(`STARTTLS failed: ${startTlsResponse}`);
    }

    // Upgrade connection to TLS
    this.conn = await Deno.startTls(this.conn, {
      hostname: this.hostname,
    });

    // Send EHLO again after TLS and re-parse capabilities
    const ehloTlsResponse = await this.sendCommand(`EHLO ${this.hostname}`);
    if (!ehloTlsResponse.startsWith('250')) {
      throw new Error(`EHLO after TLS failed: ${ehloTlsResponse}`);
    }
    
    this.parseEhloCapabilities(ehloTlsResponse);
  }

  private async upgradeTo465TLS(): Promise<void> {
    // For port 465, upgrade to TLS immediately
    this.conn = await Deno.startTls(this.conn, {
      hostname: this.hostname,
    });

    // Send EHLO after TLS and parse capabilities
    const ehloTlsResponse = await this.sendCommand(`EHLO ${this.hostname}`);
    if (!ehloTlsResponse.startsWith('250')) {
      throw new Error(`EHLO after TLS failed: ${ehloTlsResponse}`);
    }
    
    this.parseEhloCapabilities(ehloTlsResponse);
  }

  async sendEmail(message: {
    from: string;
    to: string;
    subject: string;
    content: string;
    html?: string;
  }): Promise<void> {
    if (!this.conn) throw new Error('Not connected');

    // Extract email from "Name <email>" format
    const extractEmail = (addr: string) => {
      const match = addr.match(/<(.+)>/);
      return match ? match[1] : addr;
    };

    const fromEmail = extractEmail(message.from);
    const toEmail = extractEmail(message.to);

    // MAIL FROM
    const mailFromResponse = await this.sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (!mailFromResponse.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${mailFromResponse}`);
    }

    // RCPT TO
    const rcptToResponse = await this.sendCommand(`RCPT TO:<${toEmail}>`);
    if (!rcptToResponse.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${rcptToResponse}`);
    }

    // DATA
    const dataResponse = await this.sendCommand('DATA');
    if (!dataResponse.startsWith('354')) {
      throw new Error(`DATA failed: ${dataResponse}`);
    }

    // Build email headers and body
    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${this.hostname}>`;
    
    let emailData = `From: ${message.from}\r\n`;
    emailData += `To: ${message.to}\r\n`;
    emailData += `Subject: ${message.subject}\r\n`;
    emailData += `Date: ${date}\r\n`;
    emailData += `Message-ID: ${messageId}\r\n`;
    emailData += `MIME-Version: 1.0\r\n`;
    
    if (message.html) {
      emailData += `Content-Type: multipart/alternative; boundary="boundary123"\r\n\r\n`;
      emailData += `--boundary123\r\n`;
      emailData += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
      emailData += `${message.content}\r\n\r\n`;
      emailData += `--boundary123\r\n`;
      emailData += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
      emailData += `${message.html}\r\n\r\n`;
      emailData += `--boundary123--\r\n`;
    } else {
      emailData += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
      emailData += `${message.content}\r\n`;
    }

    emailData += '\r\n.\r\n';

    // Send email data
    console.log('📧 Sending email data...');
    const encoder = new TextEncoder();
    await this.conn.write(encoder.encode(emailData));
    
    const sendResponse = await this.readResponse();
    if (!sendResponse.startsWith('250')) {
      throw new Error(`Email send failed: ${sendResponse}`);
    }

    console.log('✅ Email sent successfully via native SMTP');
  }

  async close(): Promise<void> {
    if (this.conn) {
      try {
        await this.sendCommand('QUIT');
      } catch (e) {
        console.log('Error during QUIT:', e.message);
      }
      this.conn.close();
      this.conn = null;
    }
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Simple health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        service: 'unified-smtp-sender',
        implementation: 'native-deno',
        features: ['multi-line_responses', 'auth_detection', 'tls_fallback'],
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  // Store request body for error handling (avoids clone() issues)
  let requestBody: any = {};
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    requestBody = await req.json();
    console.log('📧 Native SMTP sender request received:', {
      to: requestBody.to,
      templateKey: requestBody.templateKey,
      hasVariables: !!requestBody.variables,
      useNative: true
    });

    // **PRIORITIZE DATABASE CONFIGURATION**
    let smtpConfig;
    let configSource = 'database';
    
    console.log('📊 Fetching SMTP configuration from database...');
    
    const { data: config } = await supabase
      .from('communication_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (config && config.use_smtp) {
      smtpConfig = {
        smtp_host: config.smtp_host?.trim() || '',
        smtp_port: config.smtp_port || 587,
        smtp_user: config.smtp_user?.trim() || '',
        smtp_pass: config.smtp_pass?.trim() || '',
        sender_email: config.sender_email?.trim() || config.smtp_user?.trim() || '',
        sender_name: config.sender_name?.trim() || 'Starters Small Chops'
      };
      
      console.log('✅ Using DATABASE SMTP configuration');
    } else {
      throw new Error('No SMTP configuration found in database');
    }

    console.log('🔍 Native SMTP Configuration:', {
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      senderEmail: smtpConfig.sender_email,
      senderName: smtpConfig.sender_name,
      usernameSet: !!smtpConfig.smtp_user,
      passwordSet: !!smtpConfig.smtp_pass
    });

    // Validate configuration
    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
      throw new Error('Invalid SMTP configuration: Missing required fields');
    }

    // Template processing
    let htmlContent = requestBody.htmlContent || '';
    let textContent = requestBody.textContent || '';
    let subject = requestBody.subject || 'Notification';

    if (requestBody.templateKey) {
      console.log(`📄 Processing template: ${requestBody.templateKey}`);
      
      try {
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('template_key', requestBody.templateKey)
          .eq('is_active', true)
          .maybeSingle();

        if (template) {
          subject = template.subject || subject;
          htmlContent = template.html_content || htmlContent;
          textContent = template.text_content || textContent;
          
          // Variable substitution
          if (requestBody.variables) {
            const variables = requestBody.variables;
            
            [subject, htmlContent, textContent].forEach((content, index) => {
              if (content) {
                let processed = content;
                Object.keys(variables).forEach(key => {
                  const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                  processed = processed.replace(regex, variables[key] || '');
                });
                
                if (index === 0) subject = processed;
                else if (index === 1) htmlContent = processed;
                else textContent = processed;
              }
            });
          }
          
          console.log(`✅ Template processed: ${template.template_key}`);
        } else {
          console.log(`⚠️ Template not found: ${requestBody.templateKey}, using fallback`);
        }
      } catch (templateError) {
        console.error('Template processing error:', templateError);
      }
    }

    // Enable debug mode for better diagnostics
    const debugMode = requestBody.debug === true;
    
    // Create native SMTP client with debug mode
    const client = new NativeSMTPClient({
      hostname: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      username: smtpConfig.smtp_user,
      password: smtpConfig.smtp_pass,
      debug: debugMode
    });

    const fromAddress = smtpConfig.sender_email || smtpConfig.smtp_user;
    const emailMessage = {
      from: `${smtpConfig.sender_name} <${fromAddress}>`,
      to: requestBody.to,
      subject: subject,
      content: textContent || htmlContent || 'No content provided',
      html: htmlContent || undefined,
    };

    console.log('📤 Sending email via native SMTP:', {
      to: emailMessage.to,
      from: emailMessage.from,
      subject: emailMessage.subject,
      hasHtml: !!emailMessage.html
    });

    try {
      // Connect and send
      await client.connect();
      await client.sendEmail(emailMessage);
      await client.close();

      // Log successful delivery
      await supabase.from('smtp_delivery_logs').insert({
        recipient_email: requestBody.to,
        subject: subject,
        delivery_status: 'sent',
        smtp_response: 'Email sent via native SMTP',
        delivery_timestamp: new Date().toISOString(),
        sender_email: fromAddress,
        provider: 'native-smtp',
        template_key: requestBody.templateKey || null,
        metadata: {
          smtp_host: smtpConfig.smtp_host,
          smtp_port: smtpConfig.smtp_port,
          implementation: 'native-deno'
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: `native-${Date.now()}`,
          provider: 'native-smtp',
          message: 'Email sent successfully via native SMTP',
          implementation: 'native-deno'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } catch (smtpError) {
      console.error('❌ Native SMTP error:', smtpError);
      
      // Enhanced fallback logic for TLS/connection errors
      const isTlsError = smtpError.message?.includes('BadResource') || 
                        smtpError.message?.includes('startTls') ||
                        smtpError.message?.includes('invalid cmd') ||
                        smtpError.message?.includes('auth');
      
      if (smtpConfig.smtp_port === 587 && isTlsError) {
        console.log('🔄 TLS/Auth error detected. Trying fallback to port 465 with SSL...');
        
        try {
          const fallbackClient = new NativeSMTPClient({
            hostname: smtpConfig.smtp_host,
            port: 465,
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_pass,
            debug: debugMode
          });

          await fallbackClient.connect();
          await fallbackClient.sendEmail(emailMessage);
          await fallbackClient.close();

          await supabase.from('smtp_delivery_logs').insert({
            recipient_email: requestBody.to,
            subject: subject,
            delivery_status: 'sent',
            smtp_response: 'Email sent via native SMTP fallback (465/SSL)',
            delivery_timestamp: new Date().toISOString(),
            sender_email: fromAddress,
            provider: 'native-smtp-fallback',
            template_key: requestBody.templateKey || null,
            metadata: {
              smtp_host: smtpConfig.smtp_host,
              smtp_port: 465,
              implementation: 'native-deno-fallback'
            }
          });

          return new Response(
            JSON.stringify({
              success: true,
              messageId: `native-fallback-${Date.now()}`,
              provider: 'native-smtp-fallback',
              message: 'Email sent via native SMTP fallback (port 465)',
              implementation: 'native-deno-fallback'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );

        } catch (fallbackError) {
          console.error('❌ Native SMTP fallback also failed:', fallbackError);
          throw new Error(`Both 587 and 465 failed. Primary: ${smtpError.message}, Fallback: ${fallbackError.message}`);
        }
      } else {
        throw smtpError;
      }
    }

  } catch (error) {
    console.error('💥 Native SMTP sender error:', error);

    // Log error to database using stored requestBody
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase.from('smtp_delivery_logs').insert({
        recipient_email: requestBody.to || 'unknown',
        subject: requestBody.subject || 'Unknown',
        delivery_status: 'failed',
        smtp_response: error.message,
        error_message: error.message,
        delivery_timestamp: new Date().toISOString(),
        sender_email: 'system',
        provider: 'native-smtp',
        template_key: requestBody.templateKey || null,
        metadata: {
          error_type: error.name,
          implementation: 'native-deno',
          function: 'native-smtp-sender'
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'native-smtp',
        implementation: 'native-deno',
        troubleshooting: {
          check_credentials: 'Using database credentials: store@startersmallchops.com',
          check_tls: 'Native TLS implementation - no external dependencies',
          check_ports: 'Trying 587 (STARTTLS) first, 465 (SSL) as fallback',
          native_implementation: 'Using pure Deno TCP/TLS APIs'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});