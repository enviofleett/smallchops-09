// Dynamic email provider configuration system
// Replaces hardcoded Gmail and other provider-specific logic

export interface EmailProviderConfig {
  name: string;
  host: string;
  ports: {
    tls: number;
    ssl: number;
    default: number;
  };
  auth: {
    type: 'password' | 'app_password' | 'api_key' | 'oauth';
    usernameFormat: 'email' | 'username' | 'api_key';
    passwordFormat?: {
      length?: number;
      pattern?: RegExp;
      description?: string;
    };
  };
  security: {
    requiresTLS: boolean;
    supports2FA: boolean;
    requiresAppPassword: boolean;
  };
  validation: {
    hostPatterns: string[];
    usernameValidation: (username: string) => { valid: boolean; error?: string };
    passwordValidation: (password: string) => { valid: boolean; error?: string };
  };
  setupInstructions: string[];
}

// Provider configuration registry
const PROVIDER_CONFIGS: Record<string, EmailProviderConfig> = {
  gmail: {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    ports: { tls: 587, ssl: 465, default: 587 },
    auth: {
      type: 'app_password',
      usernameFormat: 'email',
      passwordFormat: {
        length: 16,
        pattern: /^[a-zA-Z0-9]{16}$/,
        description: '16-character App Password'
      }
    },
    security: {
      requiresTLS: true,
      supports2FA: true,
      requiresAppPassword: true
    },
    validation: {
      hostPatterns: ['gmail.com', 'smtp.gmail.com'],
      usernameValidation: (username) => {
        // Accept any valid email format for Gmail SMTP (supports Google Workspace)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValidEmail = emailRegex.test(username);
        
        return {
          valid: isValidEmail,
          error: isValidEmail ? undefined : 'Must use valid email address'
        };
      },
      passwordValidation: (password) => ({
        valid: password.length === 16 && /^[a-zA-Z0-9]+$/.test(password),
        error: password.length === 16 ? undefined : 'App Password must be 16 characters'
      })
    },
    setupInstructions: [
      '1. Enable 2-Factor Authentication on your Google account',
      '2. Generate App Password in Google Account settings',
      '3. Use your complete email address (@gmail.com or Google Workspace domain)',
      '4. Use the 16-character App Password (remove all spaces)',
      '5. For Google Workspace: Ensure SMTP relay is enabled in Admin Console'
    ]
  },

  outlook: {
    name: 'Outlook/Office365',
    host: 'smtp-mail.outlook.com',
    ports: { tls: 587, ssl: 465, default: 587 },
    auth: {
      type: 'password',
      usernameFormat: 'email'
    },
    security: {
      requiresTLS: true,
      supports2FA: true,
      requiresAppPassword: false
    },
    validation: {
      hostPatterns: ['outlook.com', 'office365.com', 'hotmail.com', 'live.com'],
      usernameValidation: (username) => ({
        valid: username.includes('@'),
        error: username.includes('@') ? undefined : 'Must use complete email address'
      }),
      passwordValidation: () => ({ valid: true })
    },
    setupInstructions: [
      '1. Use your complete email address as username',
      '2. Use your account password or app-specific password',
      '3. Enable "Less secure app access" if needed'
    ]
  },

  sendgrid: {
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    ports: { tls: 587, ssl: 465, default: 587 },
    auth: {
      type: 'api_key',
      usernameFormat: 'api_key',
      passwordFormat: {
        pattern: /^SG\./,
        description: 'API key starting with "SG."'
      }
    },
    security: {
      requiresTLS: true,
      supports2FA: false,
      requiresAppPassword: false
    },
    validation: {
      hostPatterns: ['sendgrid.net', 'sendgrid.com'],
      usernameValidation: (username) => ({
        valid: username.toLowerCase() === 'apikey',
        error: username.toLowerCase() === 'apikey' ? undefined : 'Use "apikey" as username'
      }),
      passwordValidation: (password) => ({
        valid: password.startsWith('SG.'),
        error: password.startsWith('SG.') ? undefined : 'API key must start with "SG."'
      })
    },
    setupInstructions: [
      '1. Set username to "apikey"',
      '2. Generate API key in SendGrid dashboard',
      '3. Use API key as password'
    ]
  },

  generic: {
    name: 'Generic SMTP',
    host: '',
    ports: { tls: 587, ssl: 465, default: 587 },
    auth: {
      type: 'password',
      usernameFormat: 'email'
    },
    security: {
      requiresTLS: false,
      supports2FA: false,
      requiresAppPassword: false
    },
    validation: {
      hostPatterns: [],
      usernameValidation: () => ({ valid: true }),
      passwordValidation: () => ({ valid: true })
    },
    setupInstructions: [
      '1. Check your email provider documentation',
      '2. Configure SMTP settings as provided by your provider',
      '3. Test connection after setup'
    ]
  }
};

// Auto-detect provider from hostname
export function detectProvider(hostname: string): EmailProviderConfig {
  const lowerHost = hostname.toLowerCase();
  
  for (const [key, config] of Object.entries(PROVIDER_CONFIGS)) {
    if (key === 'generic') continue;
    
    if (config.validation.hostPatterns.some(pattern => 
      lowerHost.includes(pattern.toLowerCase())
    )) {
      return config;
    }
  }
  
  return PROVIDER_CONFIGS.generic;
}

// Validate SMTP configuration against provider requirements
export function validateSMTPConfig(
  host: string, 
  port: number, 
  username: string, 
  password: string
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  provider: EmailProviderConfig;
} {
  const provider = detectProvider(host);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate username
  const usernameResult = provider.validation.usernameValidation(username);
  if (!usernameResult.valid && usernameResult.error) {
    errors.push(usernameResult.error);
  }

  // Validate password
  const passwordResult = provider.validation.passwordValidation(password);
  if (!passwordResult.valid && passwordResult.error) {
    errors.push(passwordResult.error);
  }

  // Validate port
  const validPorts = [provider.ports.tls, provider.ports.ssl];
  if (!validPorts.includes(port)) {
    warnings.push(`Port ${port} is not standard for ${provider.name}. Consider using ${provider.ports.default}`);
  }

  // Security warnings
  if (provider.security.requiresAppPassword && provider.auth.type === 'password') {
    warnings.push(`${provider.name} recommends using App Passwords for better security`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    provider
  };
}

// Get provider configuration by name
export function getProviderConfig(providerName: string): EmailProviderConfig {
  return PROVIDER_CONFIGS[providerName.toLowerCase()] || PROVIDER_CONFIGS.generic;
}

// List all available providers
export function listProviders(): EmailProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.name !== 'Generic SMTP');
}