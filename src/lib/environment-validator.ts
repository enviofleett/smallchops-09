/**
 * Environment Configuration Validator
 * Ensures all required environment variables are properly configured for production
 */

import { ApplicationError, ErrorSeverity, ErrorCategory, errorLogger } from './error-handling';

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  suggestions: string[];
}

// Define required and optional environment variables
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

const OPTIONAL_ENV_VARS = [
  'VITE_PAYSTACK_PUBLIC_KEY',
  'VITE_APP_URL',
  'VITE_ENVIRONMENT',
] as const;

const PRODUCTION_REQUIRED_ENV_VARS = [
  'VITE_PAYSTACK_PUBLIC_KEY',
  'VITE_APP_URL',
] as const;

// Environment variable patterns for validation
const ENV_PATTERNS = {
  VITE_SUPABASE_URL: /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/,
  VITE_SUPABASE_ANON_KEY: /^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/,
  VITE_PAYSTACK_PUBLIC_KEY: /^pk_(test|live)_[a-zA-Z0-9]+$/,
  VITE_APP_URL: /^https?:\/\/.+$/,
} as const;

class EnvironmentValidator {
  static validateEnvironment(): EnvironmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequired: string[] = [];
    const suggestions: string[] = [];

    const isProduction = import.meta.env.PROD || import.meta.env.VITE_ENVIRONMENT === 'production';

    // Check required environment variables
    REQUIRED_ENV_VARS.forEach(envVar => {
      const value = import.meta.env[envVar];
      
      if (!value) {
        missingRequired.push(envVar);
        errors.push(`Required environment variable ${envVar} is missing`);
      } else {
        // Validate format if pattern exists
        const pattern = ENV_PATTERNS[envVar];
        if (pattern && !pattern.test(value)) {
          errors.push(`Environment variable ${envVar} has invalid format`);
        }
      }
    });

    // Check production-required variables
    if (isProduction) {
      PRODUCTION_REQUIRED_ENV_VARS.forEach(envVar => {
        const value = import.meta.env[envVar];
        
        if (!value) {
          errors.push(`Production environment variable ${envVar} is missing`);
          suggestions.push(`Add ${envVar} to your production environment configuration`);
        } else {
          const pattern = ENV_PATTERNS[envVar];
          if (pattern && !pattern.test(value)) {
            errors.push(`Production environment variable ${envVar} has invalid format`);
          }
        }
      });

      // Production-specific validations
      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (paystackKey) {
        if (paystackKey.startsWith('pk_test_')) {
          warnings.push('Using Paystack test key in production environment');
          suggestions.push('Switch to a live Paystack public key (pk_live_) for production');
        }
      }

      // Check for hardcoded values that shouldn't be in production
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl === 'https://oknnklksdiqaifhxaccs.supabase.co') {
        warnings.push('Using default Supabase URL - ensure this is correct for production');
      }
    }

    // Security checks
    const appUrl = import.meta.env.VITE_APP_URL;
    if (appUrl && !appUrl.startsWith('https://') && isProduction) {
      errors.push('Production app URL must use HTTPS');
      suggestions.push('Update VITE_APP_URL to use https:// protocol');
    }

    // Environment consistency checks
    const environment = import.meta.env.VITE_ENVIRONMENT || import.meta.env.NODE_ENV;
    if (isProduction && environment !== 'production') {
      warnings.push(`Environment mismatch: NODE_ENV is production but VITE_ENVIRONMENT is ${environment}`);
    }

    // Suggestions for missing optional variables
    OPTIONAL_ENV_VARS.forEach(envVar => {
      const value = import.meta.env[envVar];
      if (!value && !PRODUCTION_REQUIRED_ENV_VARS.includes(envVar as any)) {
        suggestions.push(`Consider setting ${envVar} for enhanced functionality`);
      }
    });

    const isValid = errors.length === 0 && missingRequired.length === 0;

    return {
      isValid,
      errors,
      warnings,
      missingRequired,
      suggestions,
    };
  }

  static validateAndThrow(): void {
    const result = this.validateEnvironment();
    
    if (!result.isValid) {
      const error = new ApplicationError(
        `Environment validation failed: ${result.errors.join(', ')}`,
        'ENV_VALIDATION_ERROR',
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM,
        {
          errors: result.errors,
          missingRequired: result.missingRequired,
          warnings: result.warnings,
        }
      );
      
      errorLogger.logCritical(error);
      throw error;
    }

    // Log warnings
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        errorLogger.log(new ApplicationError(
          warning,
          'ENV_WARNING',
          ErrorSeverity.LOW,
          ErrorCategory.SYSTEM
        ));
      });
    }
  }

  static getEnvironmentInfo() {
    return {
      nodeEnv: import.meta.env.NODE_ENV,
      mode: import.meta.env.MODE,
      isProduction: import.meta.env.PROD,
      isDevelopment: import.meta.env.DEV,
      customEnvironment: import.meta.env.VITE_ENVIRONMENT,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'configured' : 'missing',
      paystackKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ? 'configured' : 'missing',
      appUrl: import.meta.env.VITE_APP_URL ? 'configured' : 'missing',
    };
  }

  static logEnvironmentStatus(): void {
    const info = this.getEnvironmentInfo();
    const validation = this.validateEnvironment();

    console.group('🔧 Environment Configuration Status');
    console.table(info);
    
    if (validation.errors.length > 0) {
      console.error('❌ Errors:', validation.errors);
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Warnings:', validation.warnings);
    }
    
    if (validation.suggestions.length > 0) {
      console.info('💡 Suggestions:', validation.suggestions);
    }
    
    console.log(validation.isValid ? '✅ Environment validation passed' : '❌ Environment validation failed');
    console.groupEnd();
  }
}

// Auto-validate environment on import in production
if (import.meta.env.PROD) {
  try {
    EnvironmentValidator.validateAndThrow();
  } catch (error) {
    console.error('Critical environment validation error:', error);
    // Don't throw in production to prevent app crash, but log critical error
  }
}

// Log environment status in development
if (import.meta.env.DEV) {
  EnvironmentValidator.logEnvironmentStatus();
}

export { EnvironmentValidator };
export type { EnvironmentValidationResult };