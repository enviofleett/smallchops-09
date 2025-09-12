import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateSMTPUser, isValidSMTPConfig, maskSMTPConfig, getProviderSpecificSettings, type SMTPUserValidation } from '../_shared/smtp-config.ts';

// Production mode configuration
const isProductionMode = Deno.env.get('EMAIL_PRODUCTION_MODE')?.toLowerCase() === 'true' || 
                        Deno.env.get('DENO_ENV') === 'production';

console.log(`🔒 Email Production Mode: ${isProductionMode ? 'ENABLED' : 'DISABLED'} (EMAIL_PRODUCTION_MODE=${Deno.env.get('EMAIL_PRODUCTION_MODE')}, DENO_ENV=${Deno.env.get('DENO_ENV')})`);

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

// Import shared SMTP utilities - mask function now in shared module

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

// Production-ready SMTP user type detection and validation
interface SMTPUserValidation {
  isValid: boolean;
  userType: 'email' | 'api_key' | 'username' | 'unknown';
  provider?: string;
  errors: string[];
  suggestions: string[];
}

function validateSMTPUser(user: string, host: string): SMTPUserValidation {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let userType: 'email' | 'api_key' | 'username' | 'unknown' = 'unknown';
  let provider: string | undefined;

  // Detect user type based on format and host
  if (user.includes('@')) {
    userType = 'email';
    const domain = user.split('@')[1]?.toLowerCase();
    if (domain) {
      if (domain.includes('gmail')) provider = 'gmail';
      else if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) provider = 'outlook';
      else if (domain.includes('yahoo')) provider = 'yahoo';
    }
  } else if (user.toLowerCase().startsWith('apikey') || user.toLowerCase().includes('api') || user.length > 20) {
    userType = 'api_key';
  } else if (user.length >= 3 && !user.includes('@')) {
    userType = 'username';
  }

  // Host-based provider detection for validation
  const detectProviderFromHost = (hostname: string): string | undefined => {
    const h = hostname.toLowerCase();
    if (h.includes('gmail')) return 'gmail';
    if (h.includes('outlook') || h.includes('office365') || h.includes('hotmail')) return 'outlook';
    if (h.includes('sendgrid')) return 'sendgrid';
    if (h.includes('mailgun')) return 'mailgun';
    if (h.includes('ses') || h.includes('amazonses')) return 'aws_ses';
    if (h.includes('postmark')) return 'postmark';
    if (h.includes('mailersend')) return 'mailersend';
    if (h.includes('yahoo')) return 'yahoo';
    return undefined;
  };

  const hostProvider = detectProviderFromHost(host);

  // Provider-specific validation rules
  switch (hostProvider) {
    case 'gmail':
      if (userType !== 'email') {
        errors.push('Gmail SMTP requires full email address as SMTP_USER');
        suggestions.push('Use your complete Gmail address (e.g., user@gmail.com)');
      } else if (!user.toLowerCase().includes('gmail.com')) {
        errors.push('Gmail SMTP host requires Gmail email address');
        suggestions.push('Use your Gmail address ending with @gmail.com');
      }
      break;

    case 'outlook':
      if (userType !== 'email') {
        errors.push('Outlook/Office365 SMTP requires full email address as SMTP_USER');
        suggestions.push('Use your complete Outlook/Hotmail/Office365 email address');
      }
      break;

    case 'sendgrid':
      if (userType !== 'api_key' && user.toLowerCase() !== 'apikey') {
        errors.push('SendGrid SMTP typically uses "apikey" as SMTP_USER');
        suggestions.push('Set SMTP_USER to "apikey" and use your API key as SMTP_PASS');
      }
      break;

    case 'mailgun':
      if (userType !== 'api_key' && userType !== 'username') {
        errors.push('Mailgun SMTP requires API username or postmaster email');
        suggestions.push('Use your Mailgun API username or postmaster@yourdomain.com');
      }
      break;

    case 'aws_ses':
      if (userType !== 'api_key' && userType !== 'username') {
        errors.push('Amazon SES requires SMTP username (not email address)');
        suggestions.push('Use your AWS SES SMTP username (20-character string starting with AKIA)');
      }
      break;

    case 'postmark':
      if (userType !== 'api_key') {
        errors.push('Postmark SMTP uses API tokens, not email addresses');
        suggestions.push('Use your Postmark SMTP token as SMTP_USER');
      }
      break;

    default:
      // Generic validation for unknown providers
      if (userType === 'unknown') {
        errors.push(`SMTP_USER format unclear for provider. Should be email, API key, or username`);
        suggestions.push('Check your email provider documentation for correct SMTP_USER format');
      }
  }

  // Check for obvious placeholder/test values
  const placeholderPatterns = ['test', 'example', 'placeholder', 'your-email', 'user@domain'];
  if (placeholderPatterns.some(pattern => user.toLowerCase().includes(pattern))) {
    errors.push(`SMTP_USER "${user}" appears to be a placeholder value`);
    suggestions.push('Replace with your actual SMTP username, email address, or API key');
  }

  // Check minimum length requirements
  if (user.length < 3) {
    errors.push('SMTP_USER too short - must be at least 3 characters');
    suggestions.push('Provide a valid email address, username, or API key');
  }

  return {
    isValid: errors.length === 0,
    userType,
    provider: hostProvider,
    errors,
    suggestions
  };
}

// Enhanced SMTP configuration validation supporting multiple user formats
function isValidSMTPConfig(host: string, port: string, user: string, pass: string): { 
  isValid: boolean; 
  errors: string[];
  suggestions: string[];
  userValidation?: SMTPUserValidation;
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
  
  if (hashPattern.test(user)) {
    errors.push(`SMTP_USER appears to be a hashed value (${user.substring(0,8)}...), needs actual credential`);
    suggestions.push('Set SMTP_USER to your email address, username, or API key');
  }
  
  if (hashPattern.test(pass)) {
    errors.push(`SMTP_PASS appears to be a hashed value (${pass.substring(0,8)}...), needs actual password`);
    suggestions.push('Set SMTP_PASS to your email password or API key');
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
  
  // Validate SMTP user with enhanced logic
  const userValidation = validateSMTPUser(user, host);
  if (!userValidation.isValid) {
    errors.push(...userValidation.errors);
    suggestions.push(...userValidation.suggestions);
  }
  
  // Validate password strength
  if (pass.length < 8 && !pass.toLowerCase().includes('api') && !pass.toLowerCase().includes('key')) {
    errors.push('SMTP_PASS appears too short for a secure password');
    suggestions.push('Use a strong password or API key (at least 8 characters)');
  }
  
  // Check for obvious placeholder/test values in password
  const passwordPlaceholders = ['test', 'example', 'password', 'secret', '12345'];
  if (passwordPlaceholders.some(placeholder => pass.toLowerCase().includes(placeholder))) {
    errors.push('SMTP_PASS appears to be a placeholder or weak password');
    suggestions.push('Use your actual email password or API key');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    userValidation
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
  
// Priority 1: Function Secrets (Production) - Using standardized variable names
  const secretHost = Deno.env.get('SMTP_HOST');
  const secretPort = Deno.env.get('SMTP_PORT');
  const secretUser = Deno.env.get('SMTP_USER');
  const secretPass = Deno.env.get('SMTP_PASS');

  // CRITICAL: In production, REQUIRE complete Function Secrets
  const isProduction = Deno.env.get('DENO_ENV') === 'production' || 
                       Deno.env.get('SUPABASE_URL')?.includes('supabase.co') ||
                       isProductionMode;

  if (isProduction) {
    const missingSecrets = [];
    if (!secretHost) missingSecrets.push('SMTP_HOST');
    if (!secretPort) missingSecrets.push('SMTP_PORT');
    if (!secretUser) missingSecrets.push('SMTP_USER'); 
    if (!secretPass) missingSecrets.push('SMTP_PASS');

    if (missingSecrets.length > 0) {
      const errorMsg = `
❌ PRODUCTION MODE: Missing required Function Secrets: ${missingSecrets.join(', ')}

SETUP REQUIRED:
1. Go to Supabase Dashboard → Settings → Edge Functions
2. Add the missing Function Secrets with your actual SMTP credentials:
   - SMTP_HOST: Your email provider hostname (e.g., smtp.gmail.com)
   - SMTP_PORT: Usually 587 or 465  
   - SMTP_USER: Your email address or API username
   - SMTP_PASS: Your email password or API key

SECURITY: Never use placeholder, test, or hashed values in production.
      `.trim();
      
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  if (secretHost && secretUser && secretPass) {
    console.log('✅ Using production SMTP configuration from Function Secrets');
    
    // CRITICAL: Validate that secrets contain actual values, not hashes
    const validation = isValidSMTPConfig(
      secretHost, 
      secretPort || '587', 
      secretUser, 
      secretPass
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
    
    // Provider-specific validation for Function Secrets
    const userValidation = validateSMTPUser(secretUser, secretHost);
    
    // Gmail-specific App Password validation
    if (userValidation.provider === 'gmail' && port === 587) {
      const cleanPassword = secretPass.replace(/\s+/g, '');
      if (cleanPassword.length !== 16) {
        console.warn(`⚠️ Gmail App Password should be 16 characters. Current length: ${cleanPassword.length}. Generate one at https://myaccount.google.com/apppasswords`);
      }
    }
    
    // SendGrid-specific validation
    if (userValidation.provider === 'sendgrid' && secretUser.toLowerCase() === 'apikey') {
      if (!secretPass.startsWith('SG.')) {
        console.warn('⚠️ SendGrid API key should start with "SG." - verify your API key format');
      }
    }
    
    // AWS SES validation
    if (userValidation.provider === 'aws_ses') {
      if (!secretUser.startsWith('AKIA') || secretUser.length !== 20) {
        console.warn('⚠️ AWS SES SMTP username should be 20 characters starting with "AKIA"');
      }
    }

    // Log user type detection and provider-specific settings
    console.log(`🔍 Production SMTP Configuration:`, maskSMTPConfig({
      source: 'function_secrets',
      host: secretHost,
      port: port,
      username: secretUser,
      userType: userValidation.userType,
      provider: userValidation.provider,
      senderEmail: secretUser,
      senderName: 'System',
      encryption: 'TLS'
    }));
    
    // Log provider-specific recommendations
    if (userValidation.provider) {
      const providerSettings = getProviderSpecificSettings(userValidation.provider, userValidation.userType);
      console.log(`📧 ${userValidation.provider.toUpperCase()} Settings:`, {
        recommendedPort: providerSettings.defaultPort,
        encryption: providerSettings.encryption,
        authMethod: providerSettings.authMethod,
        currentPort: port
      });
    }
    
    return {
      host: secretHost.trim(),
      port: port,
      username: secretUser.trim(),
      // Normalize password: remove spaces that are sometimes copied from UI (e.g., Gmail App Passwords)
      password: secretPass.replace(/\s+/g, '').trim(),
      senderEmail: secretUser.trim(),
      senderName: 'System',
      encryption: 'TLS',
      source: 'function_secrets'
    };
  }

  // Database Configuration (Development Fallback Only)  
  if (isProduction) {
    throw new Error('PRODUCTION MODE: Database fallback not allowed. Configure Function Secrets for production use.');
  }
  
  console.log('📧 Falling back to database SMTP configuration (development mode)');
  
  const { data: config } = await supabase
    .from('communication_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!config?.use_smtp) {
    throw new Error('No SMTP configuration found in Function Secrets or database. For production, configure Function Secrets.');
  }

  if (!config.smtp_host || !config.smtp_user) {
    const missing = [];
    if (!config.smtp_host) missing.push('host');
    if (!config.smtp_user) missing.push('username');
    throw new Error(`Incomplete database SMTP configuration: missing ${missing.join(', ')}`);
  }

  console.log('📧 Database config loaded:', maskSMTPConfig({
    host: config.smtp_host,
    port: config.smtp_port,
    user: config.smtp_user,
    encryption: 'TLS'
  }));

  const normalizedPassword = (config.smtp_pass || '').toString().replace(/\s+/g, '').trim();
  const normalizedUsername = config.smtp_user.trim();

  // Provider-specific validation for database config
  const dbUserValidation = validateSMTPUser(normalizedUsername, config.smtp_host);
  
  // Gmail-specific App Password validation for database config
  if (dbUserValidation.provider === 'gmail' && (config.smtp_port || 587) === 587) {
    if (normalizedPassword.length !== 16 && normalizedPassword.length > 0) {
      console.warn('⚠️ Gmail requires a 16-character App Password. Generate one at https://myaccount.google.com/apppasswords');
    }
  }
  
  // Log user type detection for debugging
  console.log(`📧 Database SMTP User Type: ${dbUserValidation.userType} (Provider: ${dbUserValidation.provider || 'unknown'})`);
  
  if (!dbUserValidation.isValid) {
    console.warn('⚠️ Database SMTP user validation warnings:', dbUserValidation.errors);
  }

  return {
    host: config.smtp_host.trim(),
    port: config.smtp_port || 587,
    username: normalizedUsername,
    password: normalizedPassword,
    senderEmail: (config.sender_email || normalizedUsername).trim(),
    senderName: (config.sender_name || 'System').trim(),
    encryption: 'TLS',
    source: 'database'
  };
}

// Base email layout for non-full_html templates
const BASE_EMAIL_LAYOUT = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e9ecef; }
    .brand { font-size: 24px; font-weight: bold; margin: 0; }
    .unsubscribe { margin-top: 10px; }
    .unsubscribe a { color: #6c757d; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand">{{business_name}}</h1>
    </div>
    <div class="content">
      {{content}}
    </div>
    <div class="footer">
      <p>This email was sent by {{business_name}}.</p>
      <div class="unsubscribe">
        <a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{website_url}}">Visit Website</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Template processing with fallback, base layout wrapping, and missing variable tracking
async function processTemplate(
  supabase: any, 
  templateKey: string, 
  variables: Record<string, any> = {},
  businessName: string = 'System'
): Promise<{ 
  subject: string; 
  html: string; 
  text: string; 
  templateFound: boolean;
  missingVariables: string[];
  templateType?: string;
}> {
  
  let template = null;
  let templateFound = false;
  let templateType = 'standard';

  if (templateKey) {
    try {
      // CRITICAL FIX 1: Prioritize enhanced_email_templates from Settings Page
      const { data: enhancedTemplate } = await supabase
        .from('enhanced_email_templates')
        .select('template_type, subject_template, html_template, text_template')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .maybeSingle();

      if (enhancedTemplate) {
        template = {
          subject: enhancedTemplate.subject_template,
          html_content: enhancedTemplate.html_template,
          text_content: enhancedTemplate.text_template,
          template_type: enhancedTemplate.template_type || 'standard'
        };
        templateType = template.template_type;
        templateFound = true;
        console.log(`✅ PRODUCTION_MODE: Using verified template '${templateKey}' from Email Template Manager`);
      } else {
        // Fallback to legacy email_templates view (for backwards compatibility)
        const { data: viewTemplate } = await supabase
          .from('email_templates')
          .select('*')
          .eq('template_key', templateKey)
          .eq('is_active', true)
          .maybeSingle();

        if (viewTemplate) {
          template = viewTemplate;
          templateType = viewTemplate.template_type || 'standard';
          templateFound = true;
          console.warn(`⚠️ Using legacy template (consider migrating to Email Template Manager): ${templateKey}`);
        }
      }
    } catch (error) {
      console.warn(`Template lookup failed for ${templateKey}:`, error.message);
    }
  }

  // CRITICAL FIX 2: Enhanced Production Mode Template Validation
  if (isProductionMode) {
    if (!templateKey) {
      throw new Error('PRODUCTION_MODE: All emails must specify a valid templateKey. Direct content emails are not allowed in production.');
    }
    
    if (!templateFound) {
      throw new Error(`PRODUCTION_MODE: Template '${templateKey}' not found in enhanced_email_templates. Only active templates from Email Template Manager are allowed in production.`);
    }
    
    console.log(`✅ PRODUCTION_MODE: Using verified template '${templateKey}' from Email Template Manager`);
  }

  // DEVELOPMENT MODE: Log when fallback templates are used
  if (!isProductionMode && !templateFound && templateKey) {
    console.warn(`⚠️ DEVELOPMENT_MODE: Template '${templateKey}' not found in database - using fallback. Add this template to Email Template Manager to ensure it works in production.`);
  }

  // Template processing - use template if found, fallback only in non-production
  let subject: string;
  let html: string;
  let text: string;
  
  if (templateFound && template) {
    // Use database template
    subject = template.subject || template.subject_template || `${businessName} - Notification`;
    html = template.html_content || template.html_template || '';
    text = template.text_content || template.text_template || '';
  } else if (!isProductionMode) {
    // Fallback template (only allowed in development)
    console.warn(`⚠️ DEVELOPMENT_MODE: Using fallback template for '${templateKey}'`);
    subject = `${businessName} - Important Notification`;
    html = `
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
    text = `${businessName} - Important Notification\n\nThank you for your business with us.\n\nThis is an automated notification regarding your recent activity.\n\nThis email was sent from our automated system. Please do not reply directly.`;
  } else {
    // This should never happen in production mode due to earlier checks
    throw new Error('PRODUCTION_MODE: Template processing failed - no fallback allowed');
  }

  // Extract all template variables to track missing ones
  const allContent = [subject, html, text].join(' ');
  const templateVariables = new Set<string>();
  const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let match;
  while ((match = variableRegex.exec(allContent)) !== null) {
    templateVariables.add(match[1]);
  }

  // Add base layout variables for non-full_html templates
  const enhancedVariables = { ...variables };
  if (templateType !== 'full_html') {
    enhancedVariables.business_name = enhancedVariables.business_name || businessName;
    enhancedVariables.website_url = enhancedVariables.website_url || '#';  
    enhancedVariables.unsubscribe_url = enhancedVariables.unsubscribe_url || '#';
  }

  // Variable substitution with safe replacement
  const missingVariables: string[] = [];
  if (templateVariables.size > 0) {
    [subject, html, text].forEach((content, index) => {
      if (content) {
        let processed = content;
        
        // Track which variables are actually used vs provided
        templateVariables.forEach(varName => {
          if (!(varName in enhancedVariables) || enhancedVariables[varName] === null || enhancedVariables[varName] === undefined) {
            if (!missingVariables.includes(varName)) {
              missingVariables.push(varName);
            }
          }
        });
        
        Object.entries(enhancedVariables).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            processed = processed.replace(regex, String(value));
          }
        });
        
        if (index === 0) subject = processed;
        else if (index === 1) html = processed;
        else text = processed;
      }
    });
  }

  // Apply base layout wrapping for non-full_html templates
  if (templateType !== 'full_html' && html && !html.includes('<!DOCTYPE html>')) {
    const layoutVariables = {
      ...enhancedVariables,
      content: html,
      subject: subject
    };
    
    let wrappedHtml = BASE_EMAIL_LAYOUT;
    Object.entries(layoutVariables).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        wrappedHtml = wrappedHtml.replace(regex, String(value));
      }
    });
    
    html = wrappedHtml;
  }

  return { subject, html, text, templateFound, missingVariables, templateType };
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
    const encoded = this.safeBase64Encode(authString);
    this.log(`AUTH PLAIN string length: ${authString.length}, encoded: ${encoded.length} chars`);
    
    await this.sendCommand(`AUTH PLAIN ${encoded}`, [235]);
    
    this.log('AUTH PLAIN successful');
  }

  private async authenticate(): Promise<string> {
    // Enhanced authentication with Gmail 535 error handling
    if (this.authMethods.includes('PLAIN')) {
      try {
        await this.authenticatePlain();
        return 'PLAIN';
      } catch (error) {
        // Gmail often rejects AUTH PLAIN with 535 - try LOGIN instead
        if (error.message.includes('535') && this.authMethods.includes('LOGIN')) {
          this.log('AUTH PLAIN failed with 535, retrying with AUTH LOGIN...');
          await this.authenticateLogin();
          return 'LOGIN';
        } else {
          throw error;
        }
      }
    } else if (this.authMethods.includes('LOGIN') || this.authMethods.length === 0) {
      // Fallback to LOGIN if PLAIN not available
      await this.authenticateLogin();
      return 'LOGIN';
    } else {
      throw new Error(`No supported AUTH methods. Server supports: ${this.authMethods.join(', ')}`);
    }
  }

  private normalizeCRLF(content: string): string {
    return content.replace(/\r?\n/g, '\r\n');
  }

  private dotStuff(content: string): string {
    return content.replace(/^\.(.*)$/gm, '..$1');
  }

  async connect(): Promise<{ tlsMode: string; authMethod: string; capabilities: string[] }> {
    this.log(`Connecting to ${this.hostname}:${this.port}`);
    
    try {
      // Establish TCP connection
      this.conn = await withTimeout(
        Deno.connect({ hostname: this.hostname, port: this.port }),
        TIMEOUTS.connect,
        'TCP connect'
      );

      // Read server greeting
      const greeting = await this.readResponse();
      if (greeting.code !== 220) {
        throw new Error(`Server rejected connection: ${greeting.message}`);
      }

      // Send EHLO
      const ehloResponse = await this.sendCommand(`EHLO ${this.hostname}`, [250]);
      this.parseCapabilities(ehloResponse);

      let tlsMode = 'none';
      let authMethod = '';

      // Handle TLS negotiation based on port and capabilities
      if (this.port === 587) {
        if (this.capabilities.has('STARTTLS')) {
          this.log('Starting STARTTLS negotiation...');
          await this.sendCommand('STARTTLS', [220]);
          
          this.conn = await withTimeout(
            Deno.startTls(this.conn as Deno.TcpConn, { hostname: this.hostname }),
            TIMEOUTS.connect,
            'STARTTLS upgrade'
          );
          
          tlsMode = 'starttls';
          
          // Re-negotiate after TLS
          const postTlsEhlo = await this.sendCommand(`EHLO ${this.hostname}`, [250]);
          this.parseCapabilities(postTlsEhlo);
          this.log('STARTTLS upgrade successful');
        } else {
          // STARTTLS not advertised on 587 - try fallback to 465
          throw new Error('STARTTLS not advertised on port 587');
        }
      } else if (this.port === 465) {
        this.log('Upgrading to implicit TLS...');
        this.conn = await withTimeout(
          Deno.startTls(this.conn as Deno.TcpConn, { hostname: this.hostname }),
          TIMEOUTS.connect,
          'Implicit TLS upgrade'
        );
        
        tlsMode = 'implicit';
        
        // Send EHLO after TLS
        const postTlsEhlo = await this.sendCommand(`EHLO ${this.hostname}`, [250]);
        this.parseCapabilities(postTlsEhlo);
        this.log('Implicit TLS upgrade successful');
      }

      // Authenticate
      this.log('Starting authentication...');
      authMethod = await this.authenticate();
      
      return {
        tlsMode,
        authMethod,
        capabilities: Array.from(this.capabilities)
      };

    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  async sendEmail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    if (!this.conn) throw new Error('Not connected');

    const extractEmail = (addr: string) => {
      const match = addr.match(/<(.+)>/);
      return match ? match[1] : addr;
    };

    const fromEmail = extractEmail(message.from);
    const toEmail = extractEmail(message.to);

    // MAIL FROM
    await this.sendCommand(`MAIL FROM:<${fromEmail}>`, [250]);
    
    // RCPT TO
    await this.sendCommand(`RCPT TO:<${toEmail}>`, [250]);
    
    // DATA
    await this.sendCommand('DATA', [354]);

    // Build email with proper MIME structure
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36)}@${this.hostname}>`;
    
    let emailData = '';
    emailData += `From: ${message.from}\r\n`;
    emailData += `To: ${message.to}\r\n`;
    emailData += `Subject: =?UTF-8?B?${btoa(message.subject)}?=\r\n`;
    emailData += `Date: ${new Date().toUTCString()}\r\n`;
    emailData += `Message-ID: ${messageId}\r\n`;
    emailData += `MIME-Version: 1.0\r\n`;
    
    if (message.html) {
      emailData += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
      emailData += `--${boundary}\r\n`;
      emailData += `Content-Type: text/plain; charset=UTF-8\r\n`;
      emailData += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      emailData += `${this.normalizeCRLF(message.text)}\r\n\r\n`;
      emailData += `--${boundary}\r\n`;
      emailData += `Content-Type: text/html; charset=UTF-8\r\n`;
      emailData += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      emailData += `${this.normalizeCRLF(message.html)}\r\n\r\n`;
      emailData += `--${boundary}--\r\n`;
    } else {
      emailData += `Content-Type: text/plain; charset=UTF-8\r\n`;
      emailData += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      emailData += `${this.normalizeCRLF(message.text)}\r\n`;
    }

    // Dot-stuff and send data
    const stuffedData = this.dotStuff(emailData);
    
    await withTimeout(
      this.conn.write(new TextEncoder().encode(stuffedData + '\r\n.\r\n')),
      TIMEOUTS.data,
      'Send email data'
    );
    
    const response = await this.readResponse();
    if (response.code !== 250) {
      throw new Error(`Email send failed: ${response.message}`);
    }

    this.log('Email sent successfully');
  }

  async cleanup(): Promise<void> {
    if (this.conn) {
      try {
        await this.sendCommand('QUIT', [221]);
      } catch (e) {
        this.log(`QUIT error: ${e.message}`);
      }
      try {
        this.conn.close();
      } catch (e) {
        this.log(`Close error: ${e.message}`);
      }
      this.conn = null;
    }
  }

  getLastResponseCode(): number {
    return this.lastResponseCode;
  }
}

// Error categorization for better diagnostics
function categorizeError(error: Error): { category: string; isTransient: boolean; suggestion: string } {
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout')) {
    return {
      category: 'timeout',
      isTransient: true,
      suggestion: 'Check network connectivity and increase timeout values'
    };
  }
  
  if (message.includes('authentication failed') || message.includes('535')) {
    let suggestion = 'Verify SMTP username and password credentials';
    
    // Enhanced guidance for Gmail 535 errors with specific troubleshooting
    if (message.includes('535')) {
      suggestion = 'Authentication rejected (535). For Gmail: 1) Enable 2-Step Verification, 2) Generate 16-char App Password at https://myaccount.google.com/apppasswords, 3) Use full Gmail address as SMTP_USERNAME, 4) Remove spaces from App Password, 5) Verify account security alerts, 6) Try allowing less secure app access temporarily';
    } else if (message.includes('username and password not accepted')) {
      suggestion = 'Username/password rejected. Check credentials in Function Secrets. For Gmail, use App Password (not regular password)';
    }
    
    return {
      category: 'auth',
      isTransient: false,
      suggestion: suggestion
    };
  }
  
  if (message.includes('connection') || message.includes('network') || message.includes('econnreset') || message.includes('connection refused')) {
    return {
      category: 'network',
      isTransient: true,
      suggestion: 'Check network connectivity and SMTP server availability. For Gmail, verify host is smtp.gmail.com'
    };
  }
  
  if (message.includes('starttls') || message.includes('tls') || message.includes('badresource')) {
    return {
      category: 'tls',
      isTransient: false,
      suggestion: 'TLS/STARTTLS issue. Try port 465 (implicit TLS) if 587 (STARTTLS) fails, or set SMTP_ENCRYPTION to match your provider'
    };
  }
  
  return {
    category: 'unknown',
    isTransient: false,
    suggestion: 'Check SMTP server configuration and logs for details'
  };
}

// Retry logic with exponential backoff
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorInfo = categorizeError(lastError);
      
      console.log(`${operationName} attempt ${attempt} failed: ${lastError.message}`);
      
      // Don't retry non-transient errors
      if (!errorInfo.isTransient || attempt === RETRY_CONFIG.maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelayMs
      );
      
      await sleep(baseDelay, RETRY_CONFIG.jitterFactor);
      console.log(`Retrying ${operationName} in ${baseDelay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts})`);
    }
  }
  
  throw lastError!;
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enhanced health check with optional SMTP connectivity test
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const checkSmtp = url.searchParams.get('check') === 'smtp';
    
    const healthData: any = {
      status: 'healthy',
      service: 'unified-smtp-sender',
      implementation: 'production-native-deno',
      features: [
        'function_secrets_priority',
        'template_resolution_with_fallback',
        'retry_with_exponential_backoff',
        'tls_negotiation_with_fallback',
        'multi_line_response_parsing',
        'credential_masking',
        'enhanced_error_categorization'
      ],
      timestamp: new Date().toISOString()
    };

    if (checkSmtp) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

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
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    requestBody = await req.json();
    
    // SECURITY FIX: Enhanced health check with actual SMTP authentication test
    if (requestBody.healthcheck === true || requestBody.check === 'smtp') {
      console.log('🔍 Health check request detected in POST body');
      
      try {
        const smtpConfig = await getProductionSMTPConfig(supabase);
        
        // SECURITY FIX: Test actual SMTP AUTH instead of just config loading
        console.log('🔐 Testing SMTP authentication...');
        const client = new ProductionSMTPClient(smtpConfig);
        await client.connect();
        await client.close();
        
        console.log('✅ SMTP health check passed - authentication verified');
        
        return new Response(JSON.stringify({
          success: true,
          message: 'SMTP sender health check passed - authentication verified',
          provider: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            username: smtpConfig.username?.split('@')[0] + '@***',
            senderEmail: smtpConfig.senderEmail?.split('@')[0] + '@***', 
            senderName: smtpConfig.senderName,
            encryption: smtpConfig.encryption,
            source: smtpConfig.source
          },
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (error) {
        console.error('❌ SMTP health check failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'SMTP authentication failed',
          message: error.message.includes('535') ? 
            'SMTP Authentication Error: Check username/password in Function Secrets. For Gmail, use App Passwords.' : 
            error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    // P0 HOTFIX: Validate required "to" field immediately (only for regular emails)
    if (!requestBody.to || typeof requestBody.to !== 'string' || !requestBody.to.includes('@')) {
      console.error('❌ Invalid or missing recipient email:', {
        to: requestBody.to,
        type: typeof requestBody.to,
        hasAt: requestBody.to && typeof requestBody.to === 'string' ? requestBody.to.includes('@') : false
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or missing recipient email address',
        reason: 'invalid_recipient',
        received: {
          to: requestBody.to,
          type: typeof requestBody.to
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    // Handle healthcheck requests without full SMTP validation
    if (requestBody.healthcheck) {
      // Enhanced healthcheck with credential status
      if (requestBody.check === 'credentials') {
        try {
          const smtpConfig = await getProductionSMTPConfig(supabase);
          
          const credentialNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'];
          const credentials: Record<string, any> = {};
          
          // Map our internal config to external credential names
          credentials.SMTP_HOST = smtpConfig.host;
          credentials.SMTP_PORT = smtpConfig.port.toString();
          credentials.SMTP_USERNAME = smtpConfig.username;
          credentials.SMTP_PASSWORD = smtpConfig.password;
          credentials.SMTP_FROM_EMAIL = smtpConfig.senderEmail;
          credentials.SMTP_FROM_NAME = smtpConfig.senderName;
          
          return new Response(JSON.stringify({
            status: 'healthy',
            service: 'unified-smtp-sender',
            credentials: credentials,
            source: smtpConfig.source,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'error',
            service: 'unified-smtp-sender',
            error: error.message,
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'unified-smtp-sender',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get business name for branding
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('name')
      .limit(1)
      .maybeSingle();
    
    const businessName = businessSettings?.name || 'System';

    console.log('📧 SMTP sender request:', {
      to: requestBody.to,
      templateKey: requestBody.templateKey,
      businessName,
      hasVariables: !!requestBody.variables
    });

    // Optional safety checks
    if (requestBody.to && typeof requestBody.to === 'string') {
      try {
        // Check email suppression
        const { data: suppressionCheck } = await supabase
          .rpc('is_email_suppressed', { email_address: requestBody.to });
        
        if (suppressionCheck) {
          console.log(`⚠️ Email ${requestBody.to} is suppressed - skipping send`);
          return new Response(JSON.stringify({
            success: false,
            error: 'Email address is suppressed',
            reason: 'suppressed'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // Check rate limiting
        const { data: rateLimitCheck } = await supabase
          .rpc('check_email_rate_limit', { email_address: requestBody.to });
          
        if (rateLimitCheck && !rateLimitCheck.allowed) {
          console.log(`⚠️ Rate limit exceeded for ${requestBody.to}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'Rate limit exceeded',
            reason: 'rate_limited',
            resetAt: rateLimitCheck.reset_at
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429
          });
        }
      } catch (checkError) {
        console.warn('Safety check failed:', checkError.message);
      }
    }

    // Get production SMTP configuration
    const smtpConfig = await getProductionSMTPConfig(supabase);

    // Check sender domain mismatch warning
    const senderDomain = smtpConfig.senderEmail?.split('@')[1];
    const userDomain = smtpConfig.username?.split('@')[1];
    if (senderDomain && userDomain && senderDomain !== userDomain) {
      console.warn(`⚠️ Sender domain (${senderDomain}) differs from auth domain (${userDomain})`);
    }

    // Log masked configuration
    console.log('🔍 Production SMTP Configuration:', {
      source: smtpConfig.source,
      host: smtpConfig.host,
      port: smtpConfig.port,
      username: smtpConfig.username?.split('@')[0] + '@***',
      senderEmail: smtpConfig.senderEmail?.split('@')[0] + '@***',
      senderName: smtpConfig.senderName,
      encryption: smtpConfig.encryption
    });

    // Process template with fallback and explicit subject handling
    const { subject: templateSubject, html, text, templateFound, missingVariables, templateType } = await processTemplate(
      supabase,
      requestBody.templateKey,
      requestBody.variables,
      businessName
    );
    
    // Respect explicit subject from caller if provided, otherwise use template/fallback
    const finalSubject = requestBody.subject?.trim() || templateSubject;

    if (!templateFound && requestBody.templateKey) {
      console.warn(`⚠️ Template ${requestBody.templateKey} not found - proceeding with branded fallback content`);
    }

    // Execute email sending with retry logic
    const result = await executeWithRetry(async () => {
      attemptCount++;
      
      const client = new ProductionSMTPClient({
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        password: smtpConfig.password,
        debug: requestBody.debug === true
      });

      let connectionInfo: { tlsMode: string; authMethod: string; capabilities: string[] };
      
      try {
        connectionInfo = await client.connect();
        
        await client.sendEmail({
          from: `${smtpConfig.senderName} <${smtpConfig.senderEmail}>`,
          to: requestBody.to,
          subject: finalSubject,
          text,
          html
        });
        
        return { client, connectionInfo };
      } catch (error) {
        await client.cleanup();
        throw error;
      }
    }, 'SMTP email sending');

    await result.client.cleanup();
    const elapsed = Date.now() - startTime;

    // Log successful delivery with enriched metadata
    await supabase.from('smtp_delivery_logs').insert({
      recipient_email: requestBody.to,
      subject: finalSubject,
      delivery_status: 'sent',
      smtp_response: 'Email sent successfully',
      delivery_timestamp: new Date().toISOString(),
      sender_email: smtpConfig.senderEmail,
      provider: 'native-smtp',
      template_key: requestBody.templateKey || null,
      metadata: {
        implementation: 'production-native-deno',
        smtp_host: smtpConfig.host,
        smtp_port: smtpConfig.port,
        config_source: smtpConfig.source,
        tls_mode: result.connectionInfo.tlsMode,
        auth_method: result.connectionInfo.authMethod,
        attempt_count: attemptCount,
        elapsed_ms: elapsed,
        last_smtp_code: result.client.getLastResponseCode(),
         templateFound: templateFound,
         templateType: templateType,
         fallbackUsed: !templateFound,
         missingVariables: missingVariables,
         warnings: [
           ...(!templateFound ? [`Template ${requestBody.templateKey} not found - using branded fallback`] : []),
           ...(missingVariables.length > 0 ? [`Missing template variables: ${missingVariables.join(', ')}`] : [])
         ].filter(Boolean)
      }
    });

    return new Response(JSON.stringify({
      success: true,
      messageId: `prod-${Date.now()}`,
      provider: 'native-smtp',
      implementation: 'production-native-deno',
      metadata: {
        configSource: smtpConfig.source,
        tlsMode: result.connectionInfo.tlsMode,
        authMethod: result.connectionInfo.authMethod,
        attempts: attemptCount,
        elapsedMs: elapsed
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorInfo = categorizeError(error as Error);
    
    console.error('💥 SMTP sender error:', error);

    // Log error with enriched metadata
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
        template_key: requestBody.templateKey || null,
        metadata: {
          implementation: 'production-native-deno',
          error_category: errorInfo.category,
          transient: errorInfo.isTransient,
          attempt_count: attemptCount,
          elapsed_ms: elapsed,
          suggestion: errorInfo.suggestion,
          explicit_subject_used: !!requestBody.subject?.trim()
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      provider: 'native-smtp',
      implementation: 'production-native-deno',
      diagnostics: {
        category: errorInfo.category,
        transient: errorInfo.isTransient,
        suggestion: errorInfo.suggestion,
        attempts: attemptCount,
        elapsedMs: elapsed
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});