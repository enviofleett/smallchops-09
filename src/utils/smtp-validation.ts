// Frontend SMTP validation utilities
// Production-ready validation for SMTP configuration

export interface SMTPValidationResult {
  isValid: boolean;
  userType: 'email' | 'api_key' | 'username' | 'unknown';
  provider?: string;
  errors: string[];
  suggestions: string[];
  securityWarnings: string[];
}

export function validateSMTPCredentials(
  host: string,
  port: string | number,
  username: string,
  password: string
): SMTPValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  const securityWarnings: string[] = [];
  let userType: 'email' | 'api_key' | 'username' | 'unknown' = 'unknown';
  let provider: string | undefined;

  // Detect user type and provider
  if (username.includes('@')) {
    userType = 'email';
    const domain = username.split('@')[1]?.toLowerCase();
    if (domain?.includes('gmail')) provider = 'gmail';
    else if (domain?.includes('outlook') || domain?.includes('hotmail')) provider = 'outlook';
    else if (domain?.includes('yahoo')) provider = 'yahoo';
  } else if (username.toLowerCase().includes('apikey') || username.toLowerCase().includes('api')) {
    userType = 'api_key';
  } else if (username.length >= 3) {
    userType = 'username';
  }

  // Host-based provider detection
  const hostLower = host.toLowerCase();
  if (hostLower.includes('gmail')) provider = 'gmail';
  else if (hostLower.includes('outlook') || hostLower.includes('office365')) provider = 'outlook';
  else if (hostLower.includes('sendgrid')) provider = 'sendgrid';
  else if (hostLower.includes('mailgun')) provider = 'mailgun';
  else if (hostLower.includes('ses') || hostLower.includes('amazon')) provider = 'aws_ses';

  // Validate host format
  if (!host || !host.includes('.')) {
    errors.push('Invalid SMTP host format');
    suggestions.push('Use a proper hostname like smtp.gmail.com');
  }

  // Validate port
  const portNumber = typeof port === 'string' ? parseInt(port, 10) : port;
  if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
    errors.push('Invalid port number');
    suggestions.push('Use port 587 (TLS) or 465 (SSL)');
  }

  // Validate username/email
  if (!username || username.length < 3) {
    errors.push('Username/email too short');
    suggestions.push('Provide a valid email address or username');
  }

  // Provider-specific validation
  switch (provider) {
    case 'gmail':
      if (userType !== 'email' || !username.includes('@gmail.com')) {
        errors.push('Gmail requires full Gmail email address');
        suggestions.push('Use your complete Gmail address (e.g., user@gmail.com)');
      }
      if (password.length !== 16) {
        securityWarnings.push('Gmail App Passwords are typically 16 characters');
        suggestions.push('Generate an App Password from Google Account settings');
      }
      break;

    case 'outlook':
      if (userType !== 'email') {
        errors.push('Outlook requires full email address');
        suggestions.push('Use your complete Outlook/Hotmail address');
      }
      break;

    case 'sendgrid':
      if (username.toLowerCase() !== 'apikey') {
        errors.push('SendGrid typically uses "apikey" as username');
        suggestions.push('Set username to "apikey" and use API key as password');
      }
      if (!password.startsWith('SG.')) {
        securityWarnings.push('SendGrid API keys typically start with "SG."');
      }
      break;

    case 'aws_ses':
      if (userType === 'email') {
        errors.push('AWS SES uses SMTP username, not email address');
        suggestions.push('Use your AWS SES SMTP username (20-character string)');
      }
      if (username.length !== 20 || !username.startsWith('AKIA')) {
        securityWarnings.push('AWS SES SMTP usernames are 20 characters starting with "AKIA"');
      }
      break;
  }

  // Security checks
  const insecurePatterns = ['test', 'example', 'password', '123', 'admin'];
  if (insecurePatterns.some(pattern => 
    username.toLowerCase().includes(pattern) || password.toLowerCase().includes(pattern)
  )) {
    securityWarnings.push('Credentials appear to contain test/example values');
    suggestions.push('Use your actual production SMTP credentials');
  }

  if (password.length < 8 && !password.toLowerCase().includes('api')) {
    securityWarnings.push('Password appears too short for secure authentication');
    suggestions.push('Use a strong password or API key');
  }

  return {
    isValid: errors.length === 0,
    userType,
    provider,
    errors,
    suggestions,
    securityWarnings
  };
}

export function getSMTPProviderInstructions(provider?: string): {
  name: string;
  usernameFormat: string;
  passwordType: string;
  defaultPort: number;
  instructions: string[];
} {
  const providers = {
    gmail: {
      name: 'Gmail',
      usernameFormat: 'Full email address (user@gmail.com)',
      passwordType: '16-character App Password',
      defaultPort: 587,
      instructions: [
        '1. Enable 2-Factor Authentication on your Google account',
        '2. Go to Google Account settings → Security → App passwords',
        '3. Generate a new App Password for "Mail"',
        '4. Use your Gmail address as username',
        '5. Use the 16-character App Password (no spaces)'
      ]
    },
    outlook: {
      name: 'Outlook/Hotmail/Office365',
      usernameFormat: 'Full email address',
      passwordType: 'Account password or App Password',
      defaultPort: 587,
      instructions: [
        '1. Use your full email address as username',
        '2. Use your account password',
        '3. If 2FA is enabled, generate an App Password',
        '4. Enable "Less secure app access" if required'
      ]
    },
    sendgrid: {
      name: 'SendGrid',
      usernameFormat: '"apikey" (literal text)',
      passwordType: 'SendGrid API Key',
      defaultPort: 587,
      instructions: [
        '1. Create API key in SendGrid dashboard',
        '2. Use "apikey" as username (literal text)',
        '3. Use your API key as password',
        '4. API key should start with "SG."'
      ]
    },
    aws_ses: {
      name: 'Amazon SES',
      usernameFormat: 'SMTP Username (20 characters)',
      passwordType: 'SMTP Password',
      defaultPort: 587,
      instructions: [
        '1. Go to AWS SES console → SMTP Settings',
        '2. Create SMTP credentials',
        '3. Use the generated SMTP username (starts with AKIA)',
        '4. Use the generated SMTP password'
      ]
    }
  };

  return providers[provider as keyof typeof providers] || {
    name: 'Generic SMTP',
    usernameFormat: 'Email address or username',
    passwordType: 'Password or API key',
    defaultPort: 587,
    instructions: [
      '1. Check your email provider documentation',
      '2. Use appropriate username format',
      '3. Use secure password or API key',
      '4. Enable app-specific passwords if required'
    ]
  };
}