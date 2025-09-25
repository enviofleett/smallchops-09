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

  // Generic validation that works for all providers
  const providerConfig = getProviderConfig(host);
  
  // Validate based on detected provider configuration
  if (providerConfig.usernameFormat === 'email' && userType !== 'email') {
    errors.push(`Provider requires email address as SMTP_USER`);
    suggestions.push('Use your complete email address as username');
  }
  
  if (providerConfig.usernameFormat === 'api_key' && userType !== 'api_key') {
    errors.push(`Provider requires API key as SMTP_USER`);
    suggestions.push('Check provider documentation for correct API key format');
  }
  
  // Check for provider-specific domain requirements (for email providers)
  if (userType === 'email' && hostProvider !== 'generic') {
    const userDomain = user.split('@')[1]?.toLowerCase();
    const expectedDomain = hostProvider.includes('gmail') ? 'gmail.com' : 
                          hostProvider.includes('outlook') ? ['outlook.com', 'hotmail.com', 'live.com'] :
                          null;
    
    if (expectedDomain && typeof expectedDomain === 'string' && !userDomain?.includes(expectedDomain)) {
      errors.push(`Email domain should match SMTP provider`);
      suggestions.push(`Use email address that matches your SMTP provider domain`);
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
    suggestions.push('Use a proper SMTP hostname (e.g., smtp.yourprovider.com)');
  }
  
  // Validate port range
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    errors.push(`Invalid SMTP_PORT`);
    suggestions.push('Use standard SMTP ports: 587 (TLS), 465 (SSL), or 25 (unencrypted)');
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

// Dynamic provider configuration interface
export interface ProviderConfig {
  host: string;
  port: number;
  encryption: 'TLS' | 'SSL' | 'STARTTLS';
  authMethod: string;
  requiresAppPassword?: boolean;
  passwordLength?: number;
  usernameFormat: 'email' | 'api_key' | 'username';
  notes: string[];
}

// Provider detection from environment/configuration
export function detectProviderFromHost(hostname: string): string {
  const h = hostname.toLowerCase();
  if (h.includes('gmail')) return 'gmail';
  if (h.includes('outlook') || h.includes('office365') || h.includes('hotmail')) return 'outlook';
  if (h.includes('sendgrid')) return 'sendgrid';
  if (h.includes('mailgun')) return 'mailgun';
  if (h.includes('ses') || h.includes('amazonses')) return 'aws_ses';
  if (h.includes('postmark')) return 'postmark';
  if (h.includes('yahoo')) return 'yahoo';
  return 'generic';
}

// Generic provider settings based on detected provider
export function getProviderConfig(hostname: string, port?: number): ProviderConfig {
  const provider = detectProviderFromHost(hostname);
  const defaultPort = port || 587;
  
  const configs: Record<string, ProviderConfig> = {
    gmail: {
      host: hostname,
      port: defaultPort,
      encryption: defaultPort === 465 ? 'SSL' : 'TLS',
      authMethod: 'app_password',
      requiresAppPassword: true,
      passwordLength: 16,
      usernameFormat: 'email',
      notes: [
        'Requires App Password for security',
        'Enable 2-Factor Authentication first',
        'Use complete email address as username'
      ]
    },
    outlook: {
      host: hostname,
      port: defaultPort,
      encryption: 'TLS',
      authMethod: 'password',
      usernameFormat: 'email',
      notes: [
        'Use full email address as username',
        'May require app-specific password'
      ]
    },
    sendgrid: {
      host: hostname,
      port: defaultPort,
      encryption: 'TLS',
      authMethod: 'api_key',
      usernameFormat: 'api_key',
      notes: [
        'Use "apikey" as username',
        'API key should start with "SG."'
      ]
    },
    generic: {
      host: hostname,
      port: defaultPort,
      encryption: defaultPort === 465 ? 'SSL' : 'TLS',
      authMethod: 'password',
      usernameFormat: 'email',
      notes: [
        'Standard SMTP configuration',
        'Check provider documentation for specifics'
      ]
    }
  };

  return configs[provider] || configs.generic;
}