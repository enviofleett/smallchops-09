// Dynamic email provider detection and configuration
// Replaces hardcoded provider logic throughout the application

export interface EmailProviderInfo {
  name: string;
  host: string;
  defaultPort: number;
  encryptionType: 'TLS' | 'SSL';
  authType: 'password' | 'app_password' | 'api_key';
  usernameFormat: 'email' | 'username' | 'api_key';
  setupNotes: string[];
}

const PROVIDER_DATABASE: Record<string, EmailProviderInfo> = {
  gmail: {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    defaultPort: 587,
    encryptionType: 'TLS',
    authType: 'app_password',
    usernameFormat: 'email',
    setupNotes: [
      'Enable 2-Factor Authentication',
      'Generate App Password (16 characters)',
      'Use complete Gmail address as username'
    ]
  },
  outlook: {
    name: 'Outlook',
    host: 'smtp-mail.outlook.com',
    defaultPort: 587,
    encryptionType: 'TLS',
    authType: 'password',
    usernameFormat: 'email',
    setupNotes: [
      'Use complete email address as username',
      'May require app-specific password'
    ]
  },
  office365: {
    name: 'Office 365',
    host: 'smtp.office365.com',
    defaultPort: 587,
    encryptionType: 'TLS',
    authType: 'password',
    usernameFormat: 'email',
    setupNotes: [
      'Use Office 365 email address',
      'Authentication may require modern auth'
    ]
  },
  sendgrid: {
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    defaultPort: 587,
    encryptionType: 'TLS',
    authType: 'api_key',
    usernameFormat: 'api_key',
    setupNotes: [
      'Set username to "apikey"',
      'Use SendGrid API key as password'
    ]
  },
  mailgun: {
    name: 'Mailgun',
    host: 'smtp.mailgun.org',
    defaultPort: 587,
    encryptionType: 'TLS',
    authType: 'api_key',
    usernameFormat: 'email',
    setupNotes: [
      'Use postmaster@yourdomain.mailgun.org',
      'API key as password'
    ]
  },
  aws_ses: {
    name: 'Amazon SES',
    host: 'email-smtp.us-east-1.amazonaws.com',
    defaultPort: 587,
    encryptionType: 'TLS',
    authType: 'api_key',
    usernameFormat: 'username',
    setupNotes: [
      'Generate SMTP credentials in AWS Console',
      'Use SMTP username (not IAM username)'
    ]
  }
};

// Auto-detect provider from hostname
export function detectProviderFromHost(hostname: string): EmailProviderInfo | null {
  const lowerHost = hostname.toLowerCase();
  
  for (const [key, provider] of Object.entries(PROVIDER_DATABASE)) {
    if (lowerHost.includes(key) || lowerHost.includes(provider.host.toLowerCase())) {
      return provider;
    }
  }
  
  return null;
}

// Get all available providers
export function getAllProviders(): EmailProviderInfo[] {
  return Object.values(PROVIDER_DATABASE);
}

// Get provider by name
export function getProviderByName(name: string): EmailProviderInfo | null {
  return PROVIDER_DATABASE[name.toLowerCase()] || null;
}

// Generic provider configuration for unknown providers
export function getGenericProviderInfo(hostname: string, port: number = 587): EmailProviderInfo {
  return {
    name: 'Custom SMTP',
    host: hostname,
    defaultPort: port,
    encryptionType: port === 465 ? 'SSL' : 'TLS',
    authType: 'password',
    usernameFormat: 'email',
    setupNotes: [
      'Check your email provider documentation',
      'Use complete email address as username',
      'Standard SMTP authentication'
    ]
  };
}

// Validate SMTP configuration based on provider
export function validateProviderConfig(
  hostname: string,
  port: number,
  username: string,
  password: string
): {
  isValid: boolean;
  warnings: string[];
  provider: EmailProviderInfo;
} {
  const provider = detectProviderFromHost(hostname) || getGenericProviderInfo(hostname, port);
  const warnings: string[] = [];

  // Port validation
  if (port !== provider.defaultPort) {
    warnings.push(`Port ${port} differs from ${provider.name} standard port ${provider.defaultPort}`);
  }

  // Username format validation
  if (provider.usernameFormat === 'email' && !username.includes('@')) {
    warnings.push(`${provider.name} typically requires email address as username`);
  }

  if (provider.usernameFormat === 'api_key' && username.includes('@')) {
    warnings.push(`${provider.name} typically uses API key, not email, as username`);
  }

  // Provider-specific validations
  if (provider.name === 'Gmail' && password.length !== 16) {
    warnings.push('Gmail App Passwords are typically 16 characters');
  }

  if (provider.name === 'SendGrid' && username !== 'apikey') {
    warnings.push('SendGrid username should be "apikey"');
  }

  if (provider.name === 'SendGrid' && !password.startsWith('SG.')) {
    warnings.push('SendGrid API keys typically start with "SG."');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    provider
  };
}