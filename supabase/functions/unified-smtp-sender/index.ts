import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Production mode configuration
const isProductionMode = Deno.env.get('EMAIL_PRODUCTION_MODE')?.toLowerCase() === 'true' || 
                        Deno.env.get('DENO_ENV') === 'production';

// Branded fallback configuration
const allowBrandedFallback = Deno.env.get('EMAIL_ALLOW_BRANDED_FALLBACK')?.toLowerCase() === 'true';
const brandedFallbackWhitelist = Deno.env.get('BRANDED_FALLBACK_WHITELIST')?.split(',').map(s => s.trim()) || [
  'order_status_update',
  'order_confirmation', 
  'order_preparing',
  'order_ready',
  'out_for_delivery',
  'customer_welcome',
  'admin_status_update'
];

console.log(`🔒 Email Production Mode: ${isProductionMode ? 'ENABLED' : 'DISABLED'} (EMAIL_PRODUCTION_MODE=${Deno.env.get('EMAIL_PRODUCTION_MODE')}, DENO_ENV=${Deno.env.get('DENO_ENV')})`);
console.log(`🎨 Branded Fallback Mode: ${allowBrandedFallback ? 'ENABLED' : 'DISABLED'} (Whitelist: ${brandedFallbackWhitelist.join(', ')})`);

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

// Branded Fallback Library - Curated templates for production-safe fallbacks
const BRANDED_FALLBACK_LIBRARY: Record<string, {
  subject: string;
  html: string;
  text: string;
  variables?: string[];
}> = {
  order_status_update: {
    subject: '{{business_name}} - Order {{order_number}} Status Update',
    html: `
      <h2>Order Status Update</h2>
      <p>Hello {{customer_name}},</p>
      <p>Your order <strong>#{{order_number}}</strong> status has been updated to: <strong>{{status}}</strong></p>
      {{#order_items}}
      <div style="margin: 15px 0; padding: 10px; border: 1px solid #e9ecef; border-radius: 4px;">
        <h4 style="margin: 0 0 5px 0;">{{order_items}}</h4>
      </div>
      {{/order_items}}
      <p><strong>Order Total:</strong> ₦{{total_amount}}</p>
      {{#delivery_address}}
      <p><strong>Delivery Address:</strong><br>{{delivery_address}}</p>
      {{/delivery_address}}
      <p>Thank you for choosing {{business_name}}!</p>
    `,
    text: `Order Status Update\n\nHello {{customer_name}},\n\nYour order #{{order_number}} status has been updated to: {{status}}\n\nOrder Items:\n{{order_items}}\n\nOrder Total: ₦{{total_amount}}\n\n{{#delivery_address}}Delivery Address:\n{{delivery_address}}\n\n{{/delivery_address}}Thank you for choosing {{business_name}}!`,
    variables: ['customer_name', 'order_number', 'status', 'order_items', 'total_amount', 'delivery_address']
  },
  
  order_confirmation: {
    subject: '{{business_name}} - Order Confirmation #{{order_number}}',
    html: `
      <h2>Order Confirmation</h2>
      <p>Hello {{customer_name}},</p>
      <p>Thank you for your order! We've received your order <strong>#{{order_number}}</strong> and we're preparing it for you.</p>
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px;">
        <h3 style="margin-top: 0;">Order Details</h3>
        {{order_items}}
        <p style="margin-bottom: 0;"><strong>Total: ₦{{total_amount}}</strong></p>
      </div>
      {{#delivery_address}}
      <p><strong>Delivery Address:</strong><br>{{delivery_address}}</p>
      {{/delivery_address}}
      <p>We'll keep you updated on your order status. Thank you for choosing {{business_name}}!</p>
    `,
    text: `Order Confirmation\n\nHello {{customer_name}},\n\nThank you for your order! We've received your order #{{order_number}} and we're preparing it for you.\n\nOrder Details:\n{{order_items}}\nTotal: ₦{{total_amount}}\n\n{{#delivery_address}}Delivery Address:\n{{delivery_address}}\n\n{{/delivery_address}}We'll keep you updated on your order status. Thank you for choosing {{business_name}}!`,
    variables: ['customer_name', 'order_number', 'order_items', 'total_amount', 'delivery_address']
  },
  
  order_preparing: {
    subject: '{{business_name}} - Your Order is Being Prepared #{{order_number}}',
    html: `
      <h2>Your Order is Being Prepared!</h2>
      <p>Hello {{customer_name}},</p>
      <p>Great news! We're now preparing your order <strong>#{{order_number}}</strong>.</p>
      <p>Our kitchen team is carefully preparing your items. You'll receive another notification when your order is ready.</p>
      <p><strong>Estimated preparation time:</strong> {{preparation_time}} minutes</p>
      <p>Thank you for your patience and for choosing {{business_name}}!</p>
    `,
    text: `Your Order is Being Prepared!\n\nHello {{customer_name}},\n\nGreat news! We're now preparing your order #{{order_number}}.\n\nOur kitchen team is carefully preparing your items. You'll receive another notification when your order is ready.\n\nEstimated preparation time: {{preparation_time}} minutes\n\nThank you for your patience and for choosing {{business_name}}!`,
    variables: ['customer_name', 'order_number', 'preparation_time']
  },
  
  order_ready: {
    subject: '{{business_name}} - Your Order is Ready! #{{order_number}}',
    html: `
      <h2>Your Order is Ready!</h2>
      <p>Hello {{customer_name}},</p>
      <p>Your order <strong>#{{order_number}}</strong> is now ready and waiting for you!</p>
      {{#pickup_address}}
      <div style="margin: 15px 0; padding: 10px; background: #e8f5e8; border-radius: 4px;">
        <h4>Pickup Location:</h4>
        <p>{{pickup_address}}</p>
      </div>
      {{/pickup_address}}
      <p>Please come and collect your order at your earliest convenience.</p>
      <p>Thank you for choosing {{business_name}}!</p>
    `,
    text: `Your Order is Ready!\n\nHello {{customer_name}},\n\nYour order #{{order_number}} is now ready and waiting for you!\n\n{{#pickup_address}}Pickup Location:\n{{pickup_address}}\n\n{{/pickup_address}}Please come and collect your order at your earliest convenience.\n\nThank you for choosing {{business_name}}!`,
    variables: ['customer_name', 'order_number', 'pickup_address']
  },
  
  out_for_delivery: {
    subject: '{{business_name}} - Your Order is Out for Delivery #{{order_number}}',
    html: `
      <h2>Your Order is Out for Delivery!</h2>
      <p>Hello {{customer_name}},</p>
      <p>Your order <strong>#{{order_number}}</strong> is now out for delivery and on its way to you!</p>
      {{#driver_name}}
      <div style="margin: 15px 0; padding: 10px; background: #e3f2fd; border-radius: 4px;">
        <h4>Delivery Details:</h4>
        <p><strong>Driver:</strong> {{driver_name}}</p>
        {{#driver_phone}}<p><strong>Phone:</strong> {{driver_phone}}</p>{{/driver_phone}}
        <p><strong>Estimated arrival:</strong> {{estimated_delivery_time}} minutes</p>
      </div>
      {{/driver_name}}
      <p>Please ensure someone is available to receive the order.</p>
      <p>Thank you for choosing {{business_name}}!</p>
    `,
    text: `Your Order is Out for Delivery!\n\nHello {{customer_name}},\n\nYour order #{{order_number}} is now out for delivery and on its way to you!\n\n{{#driver_name}}Delivery Details:\nDriver: {{driver_name}}\n{{#driver_phone}}Phone: {{driver_phone}}\n{{/driver_phone}}Estimated arrival: {{estimated_delivery_time}} minutes\n\n{{/driver_name}}Please ensure someone is available to receive the order.\n\nThank you for choosing {{business_name}}!`,
    variables: ['customer_name', 'order_number', 'driver_name', 'driver_phone', 'estimated_delivery_time']
  },
  
  customer_welcome: {
    subject: 'Welcome to {{business_name}}, {{customer_name}}!',
    html: `
      <h2>Welcome to {{business_name}}!</h2>
      <p>Hello {{customer_name}},</p>
      <p>Welcome! We're thrilled to have you join our family of food lovers.</p>
      <p>{{business_name}} is dedicated to providing you with delicious, fresh meals made with love and the finest ingredients.</p>
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px;">
        <h3 style="margin-top: 0;">What's Next?</h3>
        <ul style="margin: 0;">
          <li>Browse our menu and discover your favorites</li>
          <li>Place your first order and enjoy fast delivery</li>
          <li>Join our loyalty program for exclusive offers</li>
        </ul>
      </div>
      <p>Thank you for choosing {{business_name}}. We look forward to serving you!</p>
    `,
    text: `Welcome to {{business_name}}!\n\nHello {{customer_name}},\n\nWelcome! We're thrilled to have you join our family of food lovers.\n\n{{business_name}} is dedicated to providing you with delicious, fresh meals made with love and the finest ingredients.\n\nWhat's Next?\n- Browse our menu and discover your favorites\n- Place your first order and enjoy fast delivery\n- Join our loyalty program for exclusive offers\n\nThank you for choosing {{business_name}}. We look forward to serving you!`,
    variables: ['customer_name']
  },
  
  admin_status_update: {
    subject: '[{{business_name}}] Admin Alert - Order {{order_number}} Status Change',
    html: `
      <h2>Order Status Update</h2>
      <p><strong>Order:</strong> #{{order_number}}</p>
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Status changed to:</strong> {{status}}</p>
      <p><strong>Total:</strong> ₦{{total_amount}}</p>
      <p><strong>Time:</strong> {{timestamp}}</p>
      {{#delivery_address}}
      <p><strong>Delivery Address:</strong><br>{{delivery_address}}</p>
      {{/delivery_address}}
      <p>Please take appropriate action if required.</p>
    `,
    text: `Order Status Update\n\nOrder: #{{order_number}}\nCustomer: {{customer_name}} ({{customer_email}})\nStatus changed to: {{status}}\nTotal: ₦{{total_amount}}\nTime: {{timestamp}}\n\n{{#delivery_address}}Delivery Address:\n{{delivery_address}}\n\n{{/delivery_address}}Please take appropriate action if required.`,
    variables: ['order_number', 'customer_name', 'customer_email', 'status', 'total_amount', 'timestamp', 'delivery_address']
  }
};

// Enhanced template processing with branded fallback library
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
  fallbackUsed: boolean;
  fallbackMode?: 'database' | 'branded' | 'basic';
}> {
  
  let template = null;
  let templateFound = false;
  let templateType = 'standard';
  let fallbackUsed = false;
  let fallbackMode: 'database' | 'branded' | 'basic' | undefined;

  // Step 1: Try to find template in database
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
        templateType = viewTemplate.template_type || 'standard';
        templateFound = true;
        console.log(`✅ Using database template '${templateKey}' from email_templates view`);
      } else {
        // Fallback to enhanced_email_templates with field mapping
        const { data: enhancedTemplate } = await supabase
          .from('enhanced_email_templates')
          .select('template_type, subject, subject_template, html_content, html_template, text_content, text_template')
          .eq('template_key', templateKey)
          .eq('is_active', true)
          .maybeSingle();

        if (enhancedTemplate) {
          template = {
            subject: enhancedTemplate.subject || enhancedTemplate.subject_template,
            html_content: enhancedTemplate.html_content || enhancedTemplate.html_template,
            text_content: enhancedTemplate.text_content || enhancedTemplate.text_template,
            template_type: enhancedTemplate.template_type || 'standard'
          };
          templateType = template.template_type;
          templateFound = true;
          console.log(`✅ Using database template '${templateKey}' from enhanced_email_templates table`);
        }
      }
    } catch (error) {
      console.warn(`Template lookup failed for ${templateKey}:`, error.message);
    }
  }

  // Step 2: Handle missing templates based on mode and whitelist
  if (!templateFound && templateKey) {
    // Production mode with branded fallback enabled
    if (isProductionMode && allowBrandedFallback && brandedFallbackWhitelist.includes(templateKey)) {
      const brandedTemplate = BRANDED_FALLBACK_LIBRARY[templateKey];
      if (brandedTemplate) {
        template = {
          subject: brandedTemplate.subject,
          html_content: brandedTemplate.html,
          text_content: brandedTemplate.text,
          template_type: 'standard'
        };
        templateType = 'standard';
        fallbackUsed = true;
        fallbackMode = 'branded';
        console.log(`✅ PRODUCTION_MODE: Using branded fallback template '${templateKey}' (whitelisted)`);
      } else {
        throw new Error(`PRODUCTION_MODE: Template '${templateKey}' not found in database or branded fallback library.`);
      }
    }
    // Production mode without branded fallback - strict enforcement
    else if (isProductionMode) {
      throw new Error(`PRODUCTION_MODE: Template '${templateKey}' not found in database. Only active templates are allowed in production.`);
    }
    // Development mode - use branded fallback if available, otherwise basic fallback
    else {
      const brandedTemplate = BRANDED_FALLBACK_LIBRARY[templateKey];
      if (brandedTemplate) {
        template = {
          subject: brandedTemplate.subject,
          html_content: brandedTemplate.html,
          text_content: brandedTemplate.text,
          template_type: 'standard'
        };
        templateType = 'standard';
        fallbackUsed = true;
        fallbackMode = 'branded';
        console.log(`⚠️ DEVELOPMENT_MODE: Using branded fallback template '${templateKey}'`);
      } else {
        // Basic fallback for development
        fallbackUsed = true;
        fallbackMode = 'basic';
        console.warn(`⚠️ DEVELOPMENT_MODE: Using basic fallback for '${templateKey}' - add to Email Template Manager or Branded Fallback Library`);
      }
    }
  }

  // Step 3: Get business branding for enhanced variables
  let businessSettings = null;
  try {
    const { data } = await supabase
      .from('business_settings')
      .select('name, website_url, logo_url, primary_color, tagline')
      .limit(1)
      .maybeSingle();
    businessSettings = data;
  } catch (error) {
    console.warn('Failed to fetch business settings:', error.message);
  }

  // Step 4: Process template content
  let subject: string;
  let html: string;
  let text: string;
  
  if (template) {
    // Use found or branded fallback template
    subject = template.subject || template.subject_template || `${businessName} - Notification`;
    html = template.html_content || template.html_template || '';
    text = template.text_content || template.text_template || '';
  } else if (fallbackMode === 'basic') {
    // Basic fallback (development only)
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
    throw new Error('Template processing failed - no content available');
  }

  // Step 5: Enhanced variable preparation with business branding
  const enhancedVariables = { ...variables };
  
  // Add business branding variables
  enhancedVariables.business_name = enhancedVariables.business_name || businessSettings?.name || businessName;
  enhancedVariables.website_url = enhancedVariables.website_url || businessSettings?.website_url || '#';
  enhancedVariables.unsubscribe_url = enhancedVariables.unsubscribe_url || `${businessSettings?.website_url || '#'}/unsubscribe`;
  enhancedVariables.business_logo = enhancedVariables.business_logo || businessSettings?.logo_url || '';
  enhancedVariables.primary_color = enhancedVariables.primary_color || businessSettings?.primary_color || '#f59e0b';
  enhancedVariables.business_tagline = enhancedVariables.business_tagline || businessSettings?.tagline || '';

  // Step 6: Variable extraction and substitution
  const allContent = [subject, html, text].join(' ');
  const templateVariables = new Set<string>();
  const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let match;
  while ((match = variableRegex.exec(allContent)) !== null) {
    templateVariables.add(match[1]);
  }

  // Track missing variables
  const missingVariables: string[] = [];
  templateVariables.forEach(varName => {
    if (!(varName in enhancedVariables) || enhancedVariables[varName] === null || enhancedVariables[varName] === undefined) {
      missingVariables.push(varName);
    }
  });

  // Variable substitution
  [subject, html, text].forEach((content, index) => {
    if (content) {
      let processed = content;
      
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

  // Step 7: Apply base layout wrapping for non-full_html templates
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

  // Log fallback usage for monitoring
  if (fallbackUsed) {
    console.log(`📧 Fallback Usage - Template: ${templateKey}, Mode: ${fallbackMode}, Missing Variables: ${missingVariables.join(', ') || 'none'}`);
  }

  return { 
    subject, 
    html, 
    text, 
    templateFound, 
    missingVariables, 
    templateType,
    fallbackUsed,
    fallbackMode
  };
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
    // Try AUTH PLAIN first as it's more reliable for many providers
    if (this.authMethods.includes('PLAIN')) {
      await this.authenticatePlain();
      return 'PLAIN';
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
    return {
      category: 'auth',
      isTransient: false,
      suggestion: 'Verify SMTP username and password credentials'
    };
  }
  
  if (message.includes('connection') || message.includes('network') || message.includes('econnreset')) {
    return {
      category: 'network',
      isTransient: true,
      suggestion: 'Check network connectivity and SMTP server availability'
    };
  }
  
  if (message.includes('starttls') || message.includes('tls') || message.includes('badresource')) {
    return {
      category: 'tls',
      isTransient: false,
      suggestion: 'Try alternative port (465 for implicit TLS, 587 for STARTTLS)'
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
    
    // FIELD NORMALIZATION: Handle both naming conventions
    let {
      to,
      recipient_email,
      templateKey,
      template_key,
      subject,
      html,
      text,
      variables = {},
      priority = 'normal'
    } = requestBody;

    // Normalize field names - handle both to/recipient_email and templateKey/template_key
    to = to || recipient_email;
    templateKey = templateKey || template_key;

    // Update requestBody with normalized values for downstream processing
    requestBody.to = to;
    requestBody.templateKey = templateKey;
    requestBody.variables = variables;
    requestBody.priority = priority;
    
    // STRICT VALIDATION: Required fields with detailed error messages
    if (!to || typeof to !== 'string' || to.trim().length === 0 || !to.includes('@')) {
      console.error('❌ Email validation failed: Missing or invalid "to" field', { 
        originalPayload: { to: requestBody.to, recipient_email: requestBody.recipient_email },
        normalized: { to },
        type: typeof to 
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing or invalid recipient email address',
        details: 'The "to" or "recipient_email" field is required and must be a valid email address',
        received: {
          to: requestBody.to,
          recipient_email: requestBody.recipient_email,
          normalized_to: to,
          type: typeof to
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (!templateKey || typeof templateKey !== 'string' || templateKey.trim().length === 0) {
      console.error('❌ Email validation failed: Missing template key', { 
        originalPayload: { templateKey: requestBody.templateKey, template_key: requestBody.template_key },
        normalized: { templateKey },
        to: to
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing template key',
        details: 'The "templateKey" or "template_key" field is required',
        received: {
          templateKey: requestBody.templateKey,
          template_key: requestBody.template_key,
          normalized_templateKey: templateKey,
          type: typeof templateKey
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Trim and clean values
    to = to.trim();
    templateKey = templateKey.trim();
    
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
      to: to,
      templateKey: templateKey,
      businessName,
      hasVariables: !!variables,
      fieldNormalization: {
        original_to: requestBody.to !== to ? requestBody.to : 'same',
        original_templateKey: requestBody.templateKey !== templateKey ? requestBody.templateKey : 'same'
      }
    });

    // Safety checks with normalized values
    try {
      // Check email suppression
      const { data: suppressionCheck } = await supabase
        .rpc('is_email_suppressed', { email_address: to });
      
      if (suppressionCheck) {
        console.log(`⚠️ Email ${to} is suppressed - skipping send`);
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
        .rpc('check_email_rate_limit', { email_address: to });
        
      if (rateLimitCheck && !rateLimitCheck.allowed) {
        console.log(`⚠️ Rate limit exceeded for ${to}`);
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

    // Process template with enhanced branded fallback library using normalized values
    const { subject: templateSubject, html: processedHtml, text: processedText, templateFound, missingVariables, templateType, fallbackUsed, fallbackMode } = await processTemplate(
      supabase,
      templateKey,
      variables,
      businessName
    );
    
    // Respect explicit subject from caller if provided, otherwise use template/fallback
    const finalSubject = requestBody.subject?.trim() || templateSubject;

    if (fallbackUsed) {
      console.warn(`⚠️ Fallback template used for '${requestBody.templateKey}' - Mode: ${fallbackMode}, Source: ${fallbackMode === 'branded' ? 'Branded Fallback Library' : 'Basic Development Fallback'}`);
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
         fallbackUsed: fallbackUsed,
         fallbackMode: fallbackMode,
         missingVariables: missingVariables,
         warnings: [
           ...(fallbackUsed ? [`Fallback template used (${fallbackMode}) for '${requestBody.templateKey}'`] : []),
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