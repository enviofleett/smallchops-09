// Shared SMTP configuration utilities
// Production-ready SMTP user validation for all edge functions

export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  senderEmail: string;
  senderName: string;
  encryption?: string;
  source: string;
}

export interface SMTPUserValidation {
  isValid: boolean;
  userType: 'email' | 'api_key' | 'username' | 'unknown';
  provider?: string;
  errors: string[];
  suggestions: string[];
}

export function validateSMTPUser(user: string, host: string): SMTPUserValidation {
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

export function isValidSMTPConfig(host: string, port: string, user: string, pass: string): { 
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
    errors.push(`SMTP_HOST appears to be a hashed value, needs actual hostname`);
    suggestions.push('Set SMTP_HOST to your email provider hostname');
  }
  
  if (hashPattern.test(user)) {
    errors.push(`SMTP_USER appears to be a hashed value, needs actual credential`);
    suggestions.push('Set SMTP_USER to your email address, username, or API key');
  }
  
  if (hashPattern.test(pass)) {
    errors.push(`SMTP_PASS appears to be a hashed value, needs actual password`);
    suggestions.push('Set SMTP_PASS to your email password or API key');
  }
  
  // Validate hostname format
  if (!host.includes('.') || host.startsWith('http')) {
    errors.push(`Invalid SMTP_HOST format`);
    suggestions.push('Use a proper SMTP hostname like smtp.gmail.com');
  }
  
  // Validate port range
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    errors.push(`Invalid SMTP_PORT`);
    suggestions.push('Use port 587 for most providers, or 465 for SSL');
  }
  
  // Validate SMTP user with enhanced logic
  const userValidation = validateSMTPUser(user, host);
  if (!userValidation.isValid) {
    errors.push(...userValidation.errors);
    suggestions.push(...userValidation.suggestions);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    userValidation
  };
}

export function maskSMTPConfig(config: any): any {
  return {
    ...config,
    user: config.user ? config.user.replace(/.(?=.{2})/g, '*') : undefined,
    username: config.username ? config.username.replace(/.(?=.{2})/g, '*') : undefined,
    pass: config.pass ? '***MASKED***' : undefined,
    password: config.password ? '***MASKED***' : undefined
  };
}

export function getProviderSpecificSettings(provider: string, userType: string): {
  defaultPort: number;
  encryption: string;
  authMethod: string;
  notes: string[];
} {
  const settings = {
    gmail: {
      defaultPort: 587,
      encryption: 'TLS',
      authMethod: 'app_password',
      notes: [
        'Requires App Password (16 characters)',
        'Enable 2FA before generating App Password',
        'Use full Gmail address as SMTP_USER'
      ]
    },
    outlook: {
      defaultPort: 587,
      encryption: 'TLS',
      authMethod: 'password',
      notes: [
        'Use full email address as SMTP_USER',
        'May require app-specific password'
      ]
    },
    sendgrid: {
      defaultPort: 587,
      encryption: 'TLS',
      authMethod: 'api_key',
      notes: [
        'Use "apikey" as SMTP_USER',
        'API key should start with "SG."'
      ]
    },
    mailgun: {
      defaultPort: 587,
      encryption: 'TLS',
      authMethod: 'api_key',
      notes: [
        'Use postmaster@your-domain.com or API username',
        'API key format varies by plan'
      ]
    },
    aws_ses: {
      defaultPort: 587,
      encryption: 'TLS',
      authMethod: 'iam_user',
      notes: [
        'Use SMTP username (20 chars starting with AKIA)',
        'Generate SMTP credentials in SES console'
      ]
    }
  };

  return settings[provider as keyof typeof settings] || {
    defaultPort: 587,
    encryption: 'TLS',
    authMethod: 'unknown',
    notes: ['Check provider documentation for specific requirements']
  };
}