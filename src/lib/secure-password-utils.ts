/**
 * Secure password utilities for client-side validation
 * Note: Actual password hashing is handled server-side in edge functions
 */

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  score: 'weak' | 'fair' | 'good' | 'strong';
}

/**
 * Validate password strength on the client side
 * This provides immediate feedback to users before server submission
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  const errors: string[] = [];
  let score: 'weak' | 'fair' | 'good' | 'strong' = 'weak';

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Character type checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasLowercase && !hasUppercase) {
    errors.push('Password must contain at least one letter');
  }

  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }

  // Common password check
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', '12345678',
    'password1', 'admin123', 'root', 'user', 'test'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
  }

  // Calculate strength score
  let strengthPoints = 0;
  if (password.length >= 8) strengthPoints += 1;
  if (password.length >= 12) strengthPoints += 1;
  if (hasUppercase) strengthPoints += 1;
  if (hasLowercase) strengthPoints += 1;
  if (hasNumbers) strengthPoints += 1;
  if (hasSpecialChars) strengthPoints += 1;

  if (strengthPoints >= 5) score = 'strong';
  else if (strengthPoints >= 4) score = 'good';
  else if (strengthPoints >= 3) score = 'fair';
  else score = 'weak';

  return {
    valid: errors.length === 0 && strengthPoints >= 3,
    errors,
    score
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