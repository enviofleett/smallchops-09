/**
 * Secure password utilities for client-side validation
 * Note: Actual password hashing is handled server-side in edge functions
 */

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  score: 'weak' | 'fair' | 'good' | 'strong';
  isProductionReady: boolean;
  strengthPercentage: number;
}

/**
 * Validate password strength on the client side
 * This provides immediate feedback to users before server submission
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  const errors: string[] = [];
  let score: 'weak' | 'fair' | 'good' | 'strong' = 'weak';

  // Enhanced production-ready validation
  
  // Minimum length check (increased to 12 for production)
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Character type checks (all required for production)
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }

  if (!hasSpecialChars) {
    errors.push('Password must contain at least one special character');
  }

  // Expanded common password check
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', '12345678',
    'password1', 'admin123', 'root', 'user', 'test', 'iloveyou',
    'princess', 'rockyou', 'sunshine', 'football', 'charlie',
    'aa123456', 'login', 'starwars', 'hello', 'freedom', 'whatever'
  ];

  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password contains common patterns and is not secure');
  }

  // Check for repetitive patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }

  // Check for keyboard patterns
  const keyboardPatterns = ['qwerty', 'asdf', '1234', 'abcd', 'zxcv'];
  if (keyboardPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    errors.push('Password contains keyboard patterns');
  }

  // Check for sequential patterns
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('Password contains sequential patterns');
  }

  // Calculate comprehensive strength score
  let strengthPoints = 0;
  const maxPoints = 12;
  
  // Length scoring
  if (password.length >= 12) strengthPoints += 2;
  if (password.length >= 16) strengthPoints += 1;
  if (password.length >= 20) strengthPoints += 1;
  
  // Character variety
  if (hasUppercase) strengthPoints += 1;
  if (hasLowercase) strengthPoints += 1;
  if (hasNumbers) strengthPoints += 1;
  if (hasSpecialChars) strengthPoints += 2;
  
  // Multiple special characters bonus
  if ((password.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length >= 2) {
    strengthPoints += 1;
  }
  
  // Character diversity bonus
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) {
    strengthPoints += 1;
  }
  
  // Mixed case bonus
  if (hasUppercase && hasLowercase) {
    strengthPoints += 1;
  }

  // Calculate percentage and score
  const strengthPercentage = Math.round((strengthPoints / maxPoints) * 100);
  
  if (strengthPercentage >= 85) score = 'strong';
  else if (strengthPercentage >= 65) score = 'good';
  else if (strengthPercentage >= 45) score = 'fair';
  else score = 'weak';

  // Production readiness check
  const isProductionReady = password.length >= 12 && 
                           hasUppercase && 
                           hasLowercase && 
                           hasNumbers && 
                           hasSpecialChars && 
                           !commonPasswords.some(common => password.toLowerCase().includes(common)) &&
                           strengthPercentage >= 70;

  return {
    valid: errors.length === 0,
    errors,
    score,
    isProductionReady,
    strengthPercentage
  };
}

/**
 * Get password strength color for UI display
 */
export function getPasswordStrengthColor(score: 'weak' | 'fair' | 'good' | 'strong'): string {
  switch (score) {
    case 'strong': return 'text-green-600';
    case 'good': return 'text-blue-600';
    case 'fair': return 'text-yellow-600';
    case 'weak': return 'text-red-600';
    default: return 'text-gray-400';
  }
}

/**
 * Get password strength description
 */
export function getPasswordStrengthText(score: 'weak' | 'fair' | 'good' | 'strong'): string {
  switch (score) {
    case 'strong': return 'Strong password';
    case 'good': return 'Good password';
    case 'fair': return 'Fair password';
    case 'weak': return 'Weak password';
    default: return 'Enter password';
  }
}

/**
 * Sanitize password input to prevent injection attacks
 */
export function sanitizePasswordInput(password: string): string {
  // Remove any null characters and control characters except tab and newline
  return password.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, byte => charset[byte % charset.length]).join('');
}