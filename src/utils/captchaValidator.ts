/**
 * CAPTCHA validation utilities for production authentication
 */

interface CaptchaValidationResult {
  isValid: boolean;
  error?: string;
  score?: number;
}

/**
 * Validates CAPTCHA token format and basic structure
 */
export const validateCaptchaToken = (token: string | null): boolean => {
  if (!token) return false;
  
  // Basic validation for hCaptcha token format
  // hCaptcha tokens are typically long strings with specific patterns
  return (
    typeof token === 'string' &&
    token.length > 20 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  );
};

/**
 * Checks if CAPTCHA is required based on various factors
 */
export const shouldRequireCaptcha = (
  failedAttempts: number,
  lastAttemptTime: number | null,
  userAgent?: string,
  ipAddress?: string
): boolean => {
  // Always require after 2 failed attempts
  if (failedAttempts >= 2) return true;
  
  // Require if last attempt was recent (suspicious behavior)
  if (lastAttemptTime && Date.now() - lastAttemptTime < 30000) {
    return failedAttempts >= 1;
  }
  
  // Additional checks for suspicious patterns
  if (userAgent) {
    const suspiciousPatterns = [
      /bot/i,
      /crawl/i,
      /spider/i,
      /headless/i,
      /phantom/i,
      /selenium/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      return true;
    }
  }
  
  return false;
};

/**
 * Rate limiting check for CAPTCHA attempts
 */
export const checkCaptchaRateLimit = (
  attempts: number,
  timeWindow: number = 300000 // 5 minutes
): { allowed: boolean; waitTime?: number } => {
  const maxAttempts = 5;
  
  if (attempts >= maxAttempts) {
    return {
      allowed: false,
      waitTime: timeWindow
    };
  }
  
  return { allowed: true };
};

/**
 * Security scoring based on authentication behavior
 */
export const calculateSecurityScore = (
  failedAttempts: number,
  accountAge: number,
  ipReputation: 'good' | 'suspicious' | 'bad' = 'good',
  deviceFingerprint?: string
): number => {
  let score = 100;
  
  // Deduct points for failed attempts
  score -= failedAttempts * 20;
  
  // Account age factor (newer accounts are riskier)
  if (accountAge < 86400000) { // Less than 1 day
    score -= 30;
  } else if (accountAge < 604800000) { // Less than 1 week
    score -= 15;
  }
  
  // IP reputation factor
  switch (ipReputation) {
    case 'suspicious':
      score -= 25;
      break;
    case 'bad':
      score -= 50;
      break;
  }
  
  // Ensure score doesn't go below 0
  return Math.max(0, score);
};

/**
 * Production CAPTCHA configuration
 */
export const getCaptchaConfig = () => ({
  // hCaptcha site key (replace with your production key)
  siteKey: process.env.NODE_ENV === 'production' 
    ? '10000000-ffff-ffff-ffff-000000000001' // Replace with actual production key
    : '10000000-ffff-ffff-ffff-000000000001', // Demo key for development
  
  // Threshold settings
  thresholds: {
    requireAfterAttempts: 2,
    maxAttempts: 5,
    cooldownPeriod: 300000, // 5 minutes
    suspiciousActivityThreshold: 70, // Security score below this triggers CAPTCHA
  },
  
  // Feature flags
  features: {
    enableAdaptiveCaptcha: true, // Show CAPTCHA based on risk assessment
    enableRateLimit: true,
    enableDeviceFingerprinting: false, // Disable for privacy compliance
    enableIPReputation: false, // Disable if no IP reputation service
  }
});

/**
 * Validates server-side CAPTCHA response
 * This would typically be called from an edge function
 */
export const validateCaptchaResponse = async (
  token: string,
  secretKey: string
): Promise<CaptchaValidationResult> => {
  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });
    
    const data = await response.json();
    
    return {
      isValid: data.success === true,
      error: data['error-codes']?.[0],
      score: data.score // Some CAPTCHA providers return risk scores
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Network error during CAPTCHA validation'
    };
  }
};

/**
 * Client-side CAPTCHA error handling
 */
export const handleCaptchaError = (error: string): string => {
  const errorMessages: Record<string, string> = {
    'network-error': 'Network connection issue. Please check your internet connection.',
    'challenge-timeout': 'CAPTCHA challenge timed out. Please try again.',
    'challenge-closed': 'CAPTCHA was closed. Please complete the verification.',
    'challenge-expired': 'CAPTCHA expired. Please refresh and try again.',
    'missing-input-secret': 'Configuration error. Please contact support.',
    'invalid-input-secret': 'Configuration error. Please contact support.',
    'missing-input-response': 'Please complete the CAPTCHA verification.',
    'invalid-input-response': 'Invalid CAPTCHA response. Please try again.',
    'bad-request': 'Invalid request. Please refresh the page.',
    'timeout-or-duplicate': 'CAPTCHA already used or expired. Please try again.',
  };
  
  return errorMessages[error] || 'CAPTCHA verification failed. Please try again.';
};