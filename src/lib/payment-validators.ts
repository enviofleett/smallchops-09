import { createHash, randomBytes } from 'crypto';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedAmount?: number;
}

export interface AmountValidationResult extends ValidationResult {
  sanitizedAmount: number;
  formattedAmount: string;
  subunitAmount: number;
}

export interface ReferenceValidationResult extends ValidationResult {
  reference: string;
}

// Currency-specific validation rules
const CURRENCY_RULES = {
  NGN: { min: 50, max: 10000000, decimals: 2, subunit: 100 },
  USD: { min: 0.5, max: 100000, decimals: 2, subunit: 100 },
  GHS: { min: 1, max: 50000, decimals: 2, subunit: 100 },
  ZAR: { min: 5, max: 500000, decimals: 2, subunit: 100 },
  KES: { min: 50, max: 1000000, decimals: 2, subunit: 100 },
};

export class PaymentValidator {
  /**
   * Validate payment amount against currency-specific rules
   */
  static validateAmount(amount: number, currency: string = 'NGN'): AmountValidationResult {
    const errors: string[] = [];
    const rules = CURRENCY_RULES[currency as keyof typeof CURRENCY_RULES];
    
    if (!rules) {
      errors.push(`Unsupported currency: ${currency}`);
      return {
        isValid: false,
        errors,
        sanitizedAmount: 0,
        formattedAmount: '0.00',
        subunitAmount: 0
      };
    }

    // Basic type and value validation
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      errors.push('Amount must be a valid number');
    } else {
      // Range validation
      if (amount < rules.min) {
        errors.push(`Minimum amount is ${rules.min} ${currency}`);
      }
      if (amount > rules.max) {
        errors.push(`Maximum amount is ${rules.max} ${currency}`);
      }

      // Decimal precision validation
      const decimalPlaces = (amount.toString().split('.')[1] || '').length;
      if (decimalPlaces > rules.decimals) {
        errors.push(`Amount cannot have more than ${rules.decimals} decimal places`);
      }
    }

    const sanitizedAmount = Math.round(amount * Math.pow(10, rules.decimals)) / Math.pow(10, rules.decimals);
    const subunitAmount = Math.round(sanitizedAmount * rules.subunit);
    const formattedAmount = sanitizedAmount.toFixed(rules.decimals);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedAmount,
      formattedAmount,
      subunitAmount
    };
  }

  /**
   * Generate cryptographically secure payment reference
   */
  static generateSecureReference(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const randomHex = randomBytes(8).toString('hex');
    
    // Create checksum using secret key if available
    const secretKey = process.env.PAYSTACK_SECRET_KEY || 'default-key';
    const checksum = createHash('sha256')
      .update(`${timestamp}_${randomHex}_${secretKey}`)
      .digest('hex')
      .substring(0, 8);
    
    return `${prefix}_${timestamp}_${randomHex}_${checksum}`;
  }

  /**
   * Validate payment reference format
   */
  static validatePaymentReference(reference: string): ReferenceValidationResult {
    const errors: string[] = [];
    
    // Basic format validation
    if (!reference || typeof reference !== 'string') {
      errors.push('Reference must be a non-empty string');
    } else {
      // Length validation (reasonable limits)
      if (reference.length < 8) {
        errors.push('Reference too short (minimum 8 characters)');
      }
      if (reference.length > 100) {
        errors.push('Reference too long (maximum 100 characters)');
      }
      
      // Character validation (alphanumeric, underscore, dash)
      if (!/^[a-zA-Z0-9_-]+$/.test(reference)) {
        errors.push('Reference contains invalid characters (only alphanumeric, underscore, and dash allowed)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      reference: reference || ''
    };
  }

  /**
   * Convert amount to subunit for payment processors
   */
  static convertToSubunit(amount: number, currency: string = 'NGN'): number {
    const rules = CURRENCY_RULES[currency as keyof typeof CURRENCY_RULES];
    if (!rules) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
    
    return Math.round(amount * rules.subunit);
  }

  /**
   * Convert subunit amount back to main currency unit
   */
  static convertFromSubunit(subunitAmount: number, currency: string = 'NGN'): number {
    const rules = CURRENCY_RULES[currency as keyof typeof CURRENCY_RULES];
    if (!rules) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
    
    return subunitAmount / rules.subunit;
  }

  /**
   * Sanitize data for logging (removes sensitive information)
   */
  static sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'secret_key', 'private_key', 'password', 'token', 'authorization',
      'card_number', 'cvv', 'pin', 'account_number', 'routing_number',
      'social_security_number', 'tax_id'
    ];

    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Mask sensitive payment data for display
   */
  static maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 4) {
      return '**** **** **** ****';
    }
    
    const last4 = cardNumber.slice(-4);
    return `**** **** **** ${last4}`;
  }

  /**
   * Mask email for privacy
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }
    
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`;
    }
    
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }

  /**
   * Mask phone number for privacy
   */
  static maskPhone(phone: string): string {
    if (!phone || phone.length < 4) {
      return phone;
    }
    
    const last4 = phone.slice(-4);
    return `${'*'.repeat(phone.length - 4)}${last4}`;
  }
}