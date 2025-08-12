/**
 * Production CAPTCHA Configuration
 * 
 * To configure CAPTCHA for production:
 * 1. Sign up for hCaptcha at https://www.hcaptcha.com/
 * 2. Get your site key and secret key
 * 3. Configure Supabase CAPTCHA settings in dashboard
 * 4. Update the site key below
 */

export const CAPTCHA_CONFIG = {
  // hCaptcha Configuration
  SITE_KEY: process.env.NODE_ENV === 'production' 
    ? '10000000-ffff-ffff-ffff-000000000001' // Replace with your production site key
    : '10000000-ffff-ffff-ffff-000000000001', // Demo key for development
  
  // Security Thresholds
  SECURITY: {
    REQUIRE_AFTER_ATTEMPTS: 2,
    MAX_ATTEMPTS: 5,
    COOLDOWN_PERIOD: 300000, // 5 minutes in milliseconds
    SESSION_TIMEOUT: 1800000, // 30 minutes
  },
  
  // UI Configuration
  UI: {
    THEME: 'light', // 'light' | 'dark'
    SIZE: 'normal', // 'normal' | 'compact'
    SHOW_RETRY: true,
    AUTO_RESET_ON_EXPIRE: true,
  },
  
  // Feature Flags
  FEATURES: {
    ADAPTIVE_CAPTCHA: true, // Show CAPTCHA based on risk assessment
    RATE_LIMITING: true,
    ATTEMPT_TRACKING: true,
    ERROR_RECOVERY: true,
  },
  
  // Error Messages
  ERRORS: {
    NETWORK_ERROR: 'Network connection issue. Please check your internet connection.',
    CHALLENGE_TIMEOUT: 'CAPTCHA challenge timed out. Please try again.',
    CHALLENGE_CLOSED: 'CAPTCHA was closed. Please complete the verification.',
    CHALLENGE_EXPIRED: 'CAPTCHA expired. Please refresh and try again.',
    INVALID_RESPONSE: 'Invalid CAPTCHA response. Please try again.',
    RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
    CONFIGURATION_ERROR: 'Configuration error. Please contact support.',
  }
} as const;

// Export types for TypeScript support
export type CaptchaTheme = typeof CAPTCHA_CONFIG.UI.THEME;
export type CaptchaSize = typeof CAPTCHA_CONFIG.UI.SIZE;
export type CaptchaError = keyof typeof CAPTCHA_CONFIG.ERRORS;