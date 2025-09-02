import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Configuration constants
const TIMEOUTS = {
  connect: 10000,    // 10s connection timeout
  command: 8000,     // 8s command timeout  
  data: 20000        // 20s data transfer timeout
};

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  jitterFactor: 0.1
};

// Helper function for timeouts
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Sleep with optional jitter
function sleep(ms: number, jitter: number = 0): Promise<void> {
  const delay = jitter > 0 ? ms + (Math.random() * 2 - 1) * ms * jitter : ms;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// SMTP response parser
interface SMTPResponse {
  code: number;
  lines: string[];
  message: string;
}

function parseResponse(response: string): SMTPResponse {
  const lines = response.trim().split('\r\n').filter(line => line.length > 0);
  const code = parseInt(lines[0]?.substring(0, 3) || '0');
  const message = lines.map(line => line.substring(4)).join(' ');
  
  return { code, lines, message };
}

// Email validation function
function validateEmailRequest(payload: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if 'to' field exists and is valid
  if (!payload.to) {
    errors.push('Missing recipient email address ("to" field is required)');
  } else if (typeof payload.to !== 'string') {
    errors.push('Recipient email must be a string');
  } else {
    const normalizedTo = payload.to.trim().toLowerCase();
    
    // Basic email format validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(normalizedTo)) {
      errors.push(`Invalid recipient email format: "${payload.to}"`);
    }
    
    // Check for obvious test/placeholder values
    if (normalizedTo.includes('test@') || normalizedTo.includes('example.com') || 
        normalizedTo === 'user@domain.com' || normalizedTo.length < 5) {
      errors.push(`Recipient email appears to be a placeholder or test value: "${payload.to}"`);
    }
  }
  
  // Check if we have either content or a template
  if (!payload.subject && !payload.html && !payload.text && !payload.templateKey) {
    errors.push('Email must have either content (subject/html/text) or a templateKey');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate SMTP configuration values to detect invalid hashed secrets
function isValidSMTPConfig(host: string, port: string, username: string, password: string): { 
  isValid: boolean; 
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // Check for hashed values (32 hex characters) - these are invalid for SMTP
  const hashPattern = /^[a-f0-9]{32}$/;
  
  if (hashPattern.test(host)) {
    errors.push(`SMTP_HOST appears to be a hashed value (${host.substring(0,8)}...), needs actual hostname`);
    suggestions.push('Set SMTP_HOST to your email provider hostname (e.g., smtp.gmail.com)');
  }
  
  if (hashPattern.test(port)) {
    errors.push(`SMTP_PORT appears to be a hashed value (${port.substring(0,8)}...), needs actual port number`);
    suggestions.push('Set SMTP_PORT to your email provider port (usually 587 or 465)');
  }
  
  if (hashPattern.test(username)) {
    errors.push(`SMTP_USERNAME appears to be a hashed value (${username.substring(0,8)}...), needs actual email/username`);
    suggestions.push('Set SMTP_USERNAME to your email address or API username');
  }
  
  if (hashPattern.test(password)) {
    errors.push(`SMTP_PASSWORD appears to be a hashed value (${password.substring(0,8)}...), needs actual password`);
    suggestions.push('Set SMTP_PASSWORD to your email password or API key');
  }
  
  // Validate hostname format
  if (!host.includes('.') || host.startsWith('http')) {
    errors.push(`SMTP_HOST "${host}" doesn't look like a valid hostname (should be like mail.example.com)`);
    suggestions.push('Use a proper SMTP hostname like smtp.gmail.com, smtp.sendgrid.net, or smtp-mail.outlook.com');
  }
  
  // Validate port range
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    errors.push(`SMTP_PORT "${port}" is not a valid port number (should be 25, 587, or 465)`);
    suggestions.push('Use port 587 for most providers, or 465 for SSL connections');
  }
  
  // Basic email validation for username
  if (username && !username.includes('@') && !username.includes('apikey') && username.length < 10) {
    errors.push(`SMTP_USERNAME "${username}" should typically be an email address or API key`);
    suggestions.push('Use your full email address for Gmail/Outlook, or "apikey" for SendGrid');
  }
  
  // Check for obvious placeholder/test values
  if (username.toLowerCase().includes('test') || username.toLowerCase().includes('example') || username.toLowerCase() === 'starters') {
    errors.push(`SMTP_USERNAME "${username}" appears to be a placeholder or test value`);
    suggestions.push('Replace with your actual SMTP username/email address');
  }
  
  if (password.toLowerCase().includes('test') || password.toLowerCase().includes('example') || password.length < 8) {
    errors.push(`SMTP_PASSWORD appears to be a placeholder or test value`);
    suggestions.push('Use your actual email password or API key (at least 8 characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

// Get production SMTP configuration prioritizing Function Secrets
async function getProductionSMTPConfig(supabase: any): Promise<{
  host: string;
  port: number;
  username: string;
  password: string;
  senderEmail: string;
  senderName: string;
  encryption?: string;
  source: string;
}> {
  console.log('🔍 Loading SMTP configuration...');
  
  // Priority 1: Function Secrets (Production)
  const secretHost = Deno.env.get('SMTP_HOST');
  const secretPort = Deno.env.get('SMTP_PORT');
  const secretUsername = Deno.env.get('SMTP_USERNAME');
  const secretPassword = Deno.env.get('SMTP_PASSWORD');
  const secretEncryption = Deno.env.get('SMTP_ENCRYPTION');
  const secretFromName = Deno.env.get('SMTP_FROM_NAME');
  const secretFromEmail = Deno.env.get('SMTP_FROM_EMAIL');

  if (secretHost && secretUsername && secretPassword) {
    console.log('✅ Using production SMTP configuration from Function Secrets');
    
    // CRITICAL: Validate that secrets contain actual values, not hashes
    const validation = isValidSMTPConfig(
      secretHost, 
      secretPort || '587', 
      secretUsername, 
      secretPassword
    );
    
    if (!validation.isValid) {
      console.error('❌ INVALID SMTP CONFIGURATION DETECTED:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
      console.error('🔧 SUGGESTED FIXES:');
      validation.suggestions.forEach(suggestion => console.error(`   → ${suggestion}`));
      
      const detailedError = `
Invalid SMTP configuration detected. Please fix the following issues:

ERRORS:
${validation.errors.map(error => `• ${error}`).join('\n')}

SUGGESTED FIXES:
${validation.suggestions.map(suggestion => `→ ${suggestion}`).join('\n')}

SETUP GUIDE:
1. Go to Supabase Dashboard → Settings → Edge Functions
2. Add/update Function Secrets with your real SMTP credentials:
   - SMTP_HOST: Your provider's hostname (e.g., smtp.gmail.com)
   - SMTP_PORT: Usually 587 or 465
   - SMTP_USERNAME: Your email address or API username
   - SMTP_PASSWORD: Your email password or API key
   - SMTP_FROM_EMAIL: The email address to send from
   - SMTP_FROM_NAME: The display name for outgoing emails

Never use placeholder, test, or hashed values in production.
      `.trim();
      
      throw new Error(detailedError);
    }
    
    // Parse port with robust fallback
    let port = 587; // Default port
    if (secretPort) {
      const parsedPort = parseInt(secretPort.trim(), 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      } else {
        console.warn(`⚠️ Invalid SMTP_PORT value: "${secretPort}", using default 587`);
      }
    }
    
    return {
      host: secretHost.trim(),
      port: port,
      username: secretUsername.trim(),
      password: secretPassword.trim(),
      senderEmail: (secretFromEmail || secretUsername).trim(),
      senderName: (secretFromName || 'System').trim(),
      encryption: secretEncryption?.trim() || 'TLS',
      source: 'function_secrets'
    };
  }

  // Priority 2: Database fallback (Testing/Development)
  console.log('⚠️ Function Secrets not configured, falling back to database');
  const { data: config } = await supabase
    .from('communication_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!config?.use_smtp) {
    throw new Error('SMTP not configured - neither Function Secrets nor database config available');
  }

  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    const missing = [];
    if (!config.smtp_host) missing.push('host');
    if (!config.smtp_user) missing.push('username');
    if (!config.smtp_pass) missing.push('password');
    throw new Error(`Incomplete database SMTP configuration: missing ${missing.join(', ')}`);
  }

  return {
    host: config.smtp_host.trim(),
    port: config.smtp_port || 587,
    username: config.smtp_user.trim(),
    password: config.smtp_pass.trim(),
    senderEmail: (config.sender_email || config.smtp_user).trim(),
    senderName: (config.sender_name || 'System').trim(),
    encryption: 'TLS',
    source: 'database'
  };
}

// Template processing with fallback
async function processTemplate(
  supabase: any, 
  templateKey: string, 
  variables: Record<string, any> = {},
  businessName: string = 'System'
): Promise<{ subject: string; html: string; text: string; templateFound: boolean }> {
  
  let template = null;
  let templateFound = false;

  if (templateKey) {
    try {
      // First try the email_templates view (preferred)
      const { data: viewTemplate } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .maybeSingle();

      if (viewTemplate) {
        template = viewTemplate;
        templateFound = true;
      } else {
        // Fallback to enhanced_email_templates with field mapping
        const { data: enhancedTemplate } = await supabase
          .from('enhanced_email_templates')
          .select('*')
          .eq('template_key', templateKey)
          .eq('is_active', true)
          .maybeSingle();

        if (enhancedTemplate) {
          template = {
            subject: enhancedTemplate.subject || enhancedTemplate.subject_template,
            html_content: enhancedTemplate.html_content || enhancedTemplate.html_template,
            text_content: enhancedTemplate.text_content || enhancedTemplate.text_template
          };
          templateFound = true;
        }
      }
    } catch (error) {
      console.warn(`Template lookup failed for ${templateKey}:`, error.message);
    }
  }

  // Branded fallback template
  let subject = template?.subject || `${businessName} - Important Notification`;
  let html = template?.html_content || `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b; margin-bottom: 20px;">${businessName}</h2>
          <p>Thank you for your business with us.</p>
          <p>This is an automated notification regarding your recent activity.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This email was sent from our automated system. Please do not reply directly.
          </p>
        </div>
      </body>
    </html>
  `;
  let text = template?.text_content || `${businessName}\n\nThank you for your business with us.\n\nThis is an automated notification regarding your recent activity.\n\nThis email was sent from our automated system.`;

  // Variable substitution with safe replacement
  if (variables && Object.keys(variables).length > 0) {
    [subject, html, text].forEach((content, index) => {
      if (content) {
        let processed = content;
        Object.entries(variables).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            processed = processed.replace(regex, String(value));
          }
        });
        
        if (index === 0) subject = processed;
        else if (index === 1) html = processed;
        else text = processed;
      }
    });
  }

  return { subject, html, text, templateFound };
}

// Production-ready SMTP client with robust error handling
class ProductionSMTPClient {
  private hostname: string;
  private port: number;
  private username: string;
  private password: string;
  private conn: Deno.TcpConn | Deno.TlsConn | null = null;
  private debug: boolean;
  private capabilities: Set<string> = new Set();
  private authMethods: string[] = [];
  private lastResponseCode: number = 0;
  private sessionId: string;

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
    this.sessionId = Math.random().toString(36).substring(2, 8);
  }

  private log(message: string, maskCredentials: boolean = true): void {
    if (this.debug) {
      let logMessage = message;
      if (maskCredentials) {
        logMessage = logMessage
          .replace(new RegExp(this.username, 'g'), this.maskEmail(this.username))
          .replace(new RegExp(this.password, 'g'), '***MASKED***');
      }
      console.log(`[SMTP-${this.sessionId}] ${logMessage}`);
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***MASKED***';
    const maskedLocal = local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : local;
    return `${maskedLocal}@${domain}`;
  }

  private async readResponse(): Promise<SMTPResponse> {
    if (!this.conn) throw new Error('No connection established');
    
    return withTimeout(this._readResponseInternal(), TIMEOUTS.command, 'Read response');
  }

  private async _readResponseInternal(): Promise<SMTPResponse> {
    let fullResponse = '';
    const buffer = new Uint8Array(4096);
    
    while (true) {
      const n = await this.conn!.read(buffer);
      if (n === null) throw new Error('Connection closed unexpectedly');
      
      const chunk = new TextDecoder().decode(buffer.subarray(0, n));
      fullResponse += chunk;
      
      // Check for complete response - handle multi-line responses properly
      const lines = fullResponse.split('\r\n');
      
      // Find the last non-empty line
      let lastLine = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) {
          lastLine = lines[i];
          break;
        }
      }
      
      // Multi-line responses continue with "nnn-" format
      if (lastLine && /^\d{3}-/.test(lastLine)) {
        continue; // More lines expected
      }
      
      // Final line has "nnn " format or we have a complete response
      if (lastLine && /^\d{3}\s/.test(lastLine)) {
        break; // Response complete
      }
      
      // If we don't have a proper SMTP response yet, continue reading
      if (!fullResponse.endsWith('\r\n')) {
        continue;
      }
    }
    
    const response = parseResponse(fullResponse);
    this.lastResponseCode = response.code;
    this.log(`<< ${response.code} ${response.message}`);
    return response;
  }

  private async sendCommand(command: string, expectedCodes: number[] = []): Promise<SMTPResponse> {
    if (!this.conn) throw new Error('No connection established');
    
    this.log(`>> ${command}`, command.includes('AUTH'));
    
    const encoder = new TextEncoder();
    const data = command.endsWith('\r\n') ? command : command + '\r\n';
    
    await withTimeout(
      this.conn.write(encoder.encode(data)), 
      TIMEOUTS.command, 
      'Send command'
    );
    
    const response = await this.readResponse();
    
    if (expectedCodes.length > 0 && !expectedCodes.includes(response.code)) {
      throw new Error(`Expected codes ${expectedCodes.join('/')}, got ${response.code}: ${response.message}`);
    }
    
    return response;
  }

  private parseCapabilities(ehloResponse: SMTPResponse): void {
    this.capabilities.clear();
    this.authMethods = [];
    
    for (const line of ehloResponse.lines) {
      const capability = line.substring(4).trim();
      this.capabilities.add(capability.split(' ')[0].toUpperCase());
      
      if (capability.startsWith('AUTH ')) {
        this.authMethods = capability.substring(5).split(/\s+/);
        this.log(`AUTH methods: ${this.authMethods.join(', ')}`);
      }
    }
    
    this.log(`Capabilities: ${Array.from(this.capabilities).join(', ')}`);
  }

  private safeBase64Encode(str: string): string {
    // Ensure proper UTF-8 encoding before base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return btoa(String.fromCharCode(...bytes)).replace(/\n/g, '');
  }

  private async authenticateLogin(): Promise<void> {
    this.log('Authenticating with AUTH LOGIN...');
    
    await this.sendCommand('AUTH LOGIN', [334]);
    
    const encodedUsername = this.safeBase64Encode(this.username);
    this.log(`Sending username (${this.username.length} chars, encoded ${encodedUsername.length} chars)`);
    await this.sendCommand(encodedUsername, [334]);
    
    const encodedPassword = this.safeBase64Encode(this.password);
    this.log(`Sending password (${this.password.length} chars, encoded ${encodedPassword.length} chars)`);
    await this.sendCommand(encodedPassword, [235]);
    
    this.log('AUTH LOGIN successful');
  }

  private async authenticatePlain(): Promise<void> {
    this.log('Authenticating with AUTH PLAIN...');
    
    // AUTH PLAIN format: \0username\0password
    const authString = `\0${this.username}\0${this.password}`;
    const encodedAuth = this.safeBase64Encode(authString);
    
    await this.sendCommand(`AUTH PLAIN ${encodedAuth}`, [235]);
    this.log('AUTH PLAIN successful');
  }

  async connect(): Promise<void> {
    try {
      this.log(`Connecting to ${this.hostname}:${this.port}...`);
      
      // Initial TCP connection with timeout
      this.conn = await withTimeout(
        Deno.connect({ hostname: this.hostname, port: this.port }),
        TIMEOUTS.connect,
        'Initial connection'
      );
      
      this.log('TCP connection established');
      
      // Read server greeting
      const greeting = await this.readResponse();
      if (greeting.code !== 220) {
        throw new Error(`Unexpected greeting: ${greeting.message}`);
      }
      
      // Send EHLO
      const domain = Deno.env.get('SMTP_DOMAIN') || 'localhost';
      const ehloResponse = await this.sendCommand(`EHLO ${domain}`, [250]);
      this.parseCapabilities(ehloResponse);
      
      // Upgrade to TLS if available and port suggests it (587)
      if (this.capabilities.has('STARTTLS') && this.port === 587) {
        this.log('Upgrading to TLS...');
        await this.sendCommand('STARTTLS', [220]);
        
        // Upgrade the connection to TLS
        this.conn = await withTimeout(
          Deno.startTls(this.conn, { hostname: this.hostname }),
          TIMEOUTS.connect,
          'TLS upgrade'
        );
        
        this.log('TLS upgrade successful');
        
        // Re-send EHLO after TLS upgrade
        const ehloAfterTLS = await this.sendCommand(`EHLO ${domain}`, [250]);
        this.parseCapabilities(ehloAfterTLS);
      }
      
      // Authenticate using best available method
      if (this.authMethods.includes('PLAIN')) {
        await this.authenticatePlain();
      } else if (this.authMethods.includes('LOGIN')) {
        await this.authenticateLogin();
      } else {
        throw new Error(`No supported authentication method. Server supports: ${this.authMethods.join(', ')}`);
      }
      
    } catch (error) {
      if (this.conn) {
        try {
          this.conn.close();
        } catch (closeError) {
          this.log(`Error closing connection: ${closeError.message}`);
        }
        this.conn = null;
      }
      throw error;
    }
  }

  async sendEmail(config: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!this.conn) throw new Error('Not connected');
    
    try {
      // Set sender
      await this.sendCommand(`MAIL FROM:<${config.from}>`, [250]);
      
      // Set recipient
      await this.sendCommand(`RCPT TO:<${config.to}>`, [250]);
      
      // Start data transmission
      await this.sendCommand('DATA', [354]);
      
      // Prepare email content
      const emailContent = [
        `From: ${config.from}`,
        `To: ${config.to}`,
        `Subject: ${config.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="boundary-${Date.now()}"`,
        '',
        `--boundary-${Date.now()}`,
        `Content-Type: text/plain; charset=UTF-8`,
        '',
        config.text || config.html.replace(/<[^>]*>/g, ''),
        '',
        `--boundary-${Date.now()}`,
        `Content-Type: text/html; charset=UTF-8`,
        '',
        config.html,
        '',
        `--boundary-${Date.now()}--`,
        '.'
      ].join('\r\n');
      
      // Send email content
      const encoder = new TextEncoder();
      await withTimeout(
        this.conn.write(encoder.encode(emailContent)),
        TIMEOUTS.data,
        'Email content transmission'
      );
      
      // Wait for completion response
      const dataResponse = await this.readResponse();
      if (dataResponse.code !== 250) {
        throw new Error(`Email sending failed: ${dataResponse.message}`);
      }
      
      this.log(`Email sent successfully: ${dataResponse.message}`);
      
    } catch (error) {
      this.log(`Email sending failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      try {
        await this.sendCommand('QUIT', [221]);
      } catch (error) {
        this.log(`Error during QUIT: ${error.message}`);
      }
      
      try {
        this.conn.close();
      } catch (error) {
        this.log(`Error closing connection: ${error.message}`);
      }
      
      this.conn = null;
      this.log('Disconnected');
    }
  }
}

// Rate limiting check with exponential backoff
async function checkRateLimit(supabase: any, recipient: string): Promise<{ 
  allowed: boolean; 
  reason?: string; 
  retryAfter?: number;
}> {
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Count recent emails to this recipient
  const { data: recentEmails, error } = await supabase
    .from('smtp_delivery_confirmations')
    .select('id, created_at, delivery_status')
    .eq('recipient_email', recipient.toLowerCase())
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Rate limit check failed:', error.message);
    return { allowed: true }; // Fail open
  }

  const emailCount = recentEmails?.length || 0;
  const hourlyLimit = 10;

  if (emailCount >= hourlyLimit) {
    console.warn(`⚠️ Rate limit exceeded for ${recipient}`);
    return {
      allowed: false,
      reason: 'hourly_limit_exceeded',
      retryAfter: 3600 // 1 hour in seconds
    };
  }

  return { allowed: true };
}

// Get business information for branding
async function getBusinessInfo(supabase: any): Promise<{ name: string; email?: string }> {
  try {
    const { data: settings } = await supabase
      .from('business_settings')
      .select('name, admin_notification_email')
      .limit(1)
      .maybeSingle();
    
    return {
      name: settings?.name || 'Starters Small Chops',
      email: settings?.admin_notification_email
    };
  } catch (error) {
    return { name: 'Starters Small Chops' };
  }
}

// Log delivery confirmation
async function logDeliveryConfirmation(
  supabase: any, 
  recipient: string, 
  status: 'sent' | 'failed',
  errorMessage?: string,
  messageId?: string
): Promise<void> {
  try {
    await supabase.from('smtp_delivery_confirmations').insert({
      recipient_email: recipient.toLowerCase(),
      delivery_status: status,
      error_message: errorMessage,
      provider_message_id: messageId,
      delivered_at: status === 'sent' ? new Date().toISOString() : null
    });
  } catch (error) {
    console.warn('Failed to log delivery confirmation:', error.message);
  }
}

// Main serve function
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed. Use POST.' 
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await req.json();
    
    // CRITICAL: Validate email addresses before processing
    const emailValidation = validateEmailRequest(payload);
    if (!emailValidation.isValid) {
      console.error('❌ Invalid email request:', emailValidation.errors);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid email request: ' + emailValidation.errors.join(', '),
        details: emailValidation.errors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('📧 SMTP sender request (normalized):', {
      to: payload.to,
      templateKey: payload.templateKey,
      businessName: payload.businessName || 'System',
      hasVariables: !!(payload.variables && Object.keys(payload.variables).length > 0)
    });

    // Handle health check first (lightweight)
    if (payload.healthcheck || payload.test_mode || req.url.includes('health')) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const healthData: any = {
        status: 'healthy',
        service: 'unified-smtp-sender',
        timestamp: new Date().toISOString(),
        version: '2.0-production'
      };

      // Quick SMTP config check
      try {
        const smtpConfig = await getProductionSMTPConfig(supabase);
        healthData.smtpCheck = { 
          configured: true, 
          source: smtpConfig.source,
          host: smtpConfig.host,
          port: smtpConfig.port,
          username: smtpConfig.username?.split('@')[0] + '@***',
          encryption: smtpConfig.encryption
        };
      } catch (error) {
        healthData.smtpCheck = { 
          configured: false, 
          error: error.message 
        };
      }

      return new Response(JSON.stringify(healthData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Main email sending logic
    let requestBody: any = {};
    let startTime = Date.now();
    let attemptCount = 0;
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    requestBody = payload;
    
    // Handle healthcheck requests without full SMTP validation
    if (requestBody.healthcheck) {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'unified-smtp-sender',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // CRITICAL: Input normalization and validation
    // Normalize field names for backward compatibility
    if (!requestBody.to && requestBody.recipient_email) {
      requestBody.to = requestBody.recipient_email;
    }
    if (!requestBody.templateKey && requestBody.templateId) {
      requestBody.templateKey = requestBody.templateId;
    }
    if (!requestBody.htmlContent && requestBody.html_content) {
      requestBody.htmlContent = requestBody.html_content;
    }
    if (!requestBody.textContent && requestBody.text_content) {
      requestBody.textContent = requestBody.text_content;
    }

    const normalizedRecipient = requestBody.to?.trim().toLowerCase();
    
    // Rate limiting check
    const rateLimitResult = await checkRateLimit(supabase, normalizedRecipient);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded',
        details: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get business information
    const businessInfo = await getBusinessInfo(supabase);
    
    // Process template if needed
    const templateResult = await processTemplate(
      supabase, 
      requestBody.templateKey, 
      requestBody.variables || {},
      businessInfo.name
    );

    // Prepare email content
    const subject = requestBody.subject || templateResult.subject;
    const htmlContent = requestBody.htmlContent || requestBody.html || templateResult.html;
    const textContent = requestBody.textContent || requestBody.text || templateResult.text;

    console.log(`📧 Processed email content: subject="${subject?.substring(0, 50)}...", template=${requestBody.templateKey}, found=${templateResult.templateFound}`);

    // Get SMTP configuration with retry
    let smtpConfig;
    for (let configAttempt = 1; configAttempt <= 2; configAttempt++) {
      try {
        smtpConfig = await getProductionSMTPConfig(supabase);
        break;
      } catch (error) {
        if (configAttempt === 2) throw error;
        console.warn(`SMTP config attempt ${configAttempt} failed: ${error.message}`);
        await sleep(1000);
      }
    }

    console.log(`📧 Using SMTP config: ${smtpConfig.host}:${smtpConfig.port} (${smtpConfig.source})`);

    // Send email with retry logic
    let lastError: Error | null = null;
    
    for (attemptCount = 1; attemptCount <= RETRY_CONFIG.maxAttempts; attemptCount++) {
      const client = new ProductionSMTPClient({
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        password: smtpConfig.password,
        debug: true
      });

      try {
        console.log(`📧 SMTP attempt ${attemptCount}/${RETRY_CONFIG.maxAttempts} to ${normalizedRecipient}`);
        
        await client.connect();
        
        await client.sendEmail({
          from: smtpConfig.senderEmail,
          to: normalizedRecipient,
          subject: subject,
          html: htmlContent,
          text: textContent
        });
        
        await client.disconnect();
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Email sent successfully in ${processingTime}ms (attempt ${attemptCount})`);
        
        // Log successful delivery
        await logDeliveryConfirmation(
          supabase, 
          normalizedRecipient, 
          'sent',
          undefined,
          `smtp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        );

        return new Response(JSON.stringify({
          success: true,
          messageId: `smtp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          provider: 'native-smtp',
          processingTimeMs: processingTime,
          attempt: attemptCount,
          templateUsed: templateResult.templateFound,
          recipient: normalizedRecipient
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        lastError = error;
        console.error(`❌ SMTP attempt ${attemptCount} failed:`, error.message);
        
        // Always disconnect on error
        try {
          await client.disconnect();
        } catch (disconnectError) {
          console.warn('Disconnect error:', disconnectError.message);
        }
        
        // Check if this is a retryable error
        const errorMessage = error.message.toLowerCase();
        const isRetryable = !errorMessage.includes('535') && // Auth failure is not retryable
                           !errorMessage.includes('authentication') &&
                           !errorMessage.includes('invalid recipient') &&
                           attemptCount < RETRY_CONFIG.maxAttempts;
        
        if (isRetryable) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelayMs * Math.pow(2, attemptCount - 1),
            RETRY_CONFIG.maxDelayMs
          );
          console.log(`⏳ Retrying in ${delay}ms...`);
          await sleep(delay, RETRY_CONFIG.jitterFactor);
        } else {
          break; // Non-retryable error or max attempts reached
        }
      }
    }

    // All attempts failed
    const processingTime = Date.now() - startTime;
    const finalError = lastError?.message || 'Unknown SMTP error';
    
    console.error(`❌ All SMTP attempts failed after ${processingTime}ms:`, finalError);
    
    // Log failed delivery
    await logDeliveryConfirmation(
      supabase, 
      normalizedRecipient, 
      'failed',
      finalError
    );

    return new Response(JSON.stringify({
      success: false,
      error: finalError,
      processingTimeMs: processingTime,
      attempts: attemptCount,
      provider: 'native-smtp',
      recipient: normalizedRecipient
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== SMTP Sender Critical Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      provider: 'native-smtp',
      critical: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});