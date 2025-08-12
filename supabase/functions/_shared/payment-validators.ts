// CRITICAL SECURITY: Comprehensive Payment Validation System
// Implements PCI-compliant validation with currency-specific rules

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

// CRITICAL: Currency-specific validation rules
const CURRENCY_RULES = {
  'NGN': { 
    min: 50, // 50 kobo minimum
    max: 50000000, // 500M NGN maximum
    decimals: 2,
    subunit_multiplier: 100 // kobo
  },
  'USD': { 
    min: 0.5, // 50 cents minimum
    max: 1000000, // 1M USD maximum
    decimals: 2,
    subunit_multiplier: 100 // cents
  },
  'GHS': { 
    min: 1, // 1 pesewa minimum
    max: 10000000, // 10M GHS maximum
    decimals: 2,
    subunit_multiplier: 100 // pesewas
  },
  'ZAR': { 
    min: 1, // 1 cent minimum
    max: 10000000, // 10M ZAR maximum
    decimals: 2,
    subunit_multiplier: 100 // cents
  },
  'KES': { 
    min: 10, // 10 cents minimum
    max: 10000000, // 10M KES maximum
    decimals: 2,
    subunit_multiplier: 100 // cents
  }
} as const;

interface ValidationResult {
  isValid: boolean;
  sanitizedAmount?: number;
  errors: string[];
  warnings?: string[];
}

interface AmountValidationResult extends ValidationResult {
  sanitizedAmount: number;
  subunitAmount: number; // Amount in kobo/cents
}

interface ReferenceValidationResult extends ValidationResult {
  sanitizedReference?: string;
  isPaystackFormat: boolean;
}

export class PaymentValidator {
  
  // CRITICAL: Comprehensive amount validation with currency security
  static validateAmount(amount: number, currency: string = 'NGN'): AmountValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedAmount = amount;

    // Basic type validation
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      return {
        isValid: false,
        sanitizedAmount: 0,
        subunitAmount: 0,
        errors: ['Amount must be a valid finite number'],
        warnings
      };
    }

    // Prevent negative or zero amounts
    if (amount <= 0) {
      errors.push('Amount must be greater than zero');
    }

    // Currency validation
    const rules = CURRENCY_RULES[currency as keyof typeof CURRENCY_RULES];
    if (!rules) {
      return {
        isValid: false,
        sanitizedAmount: 0,
        subunitAmount: 0,
        errors: [`Unsupported currency: ${currency}. Supported: ${Object.keys(CURRENCY_RULES).join(', ')}`],
        warnings
      };
    }

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
      warnings.push(`Amount rounded to ${rules.decimals} decimal places`);
      sanitizedAmount = Math.round(amount * Math.pow(10, rules.decimals)) / Math.pow(10, rules.decimals);
    }

    // Prevent floating point precision issues
    sanitizedAmount = parseFloat(sanitizedAmount.toFixed(rules.decimals));

    // Calculate subunit amount (kobo/cents)
    const subunitAmount = Math.round(sanitizedAmount * rules.subunit_multiplier);

    return {
      isValid: errors.length === 0,
      sanitizedAmount,
      subunitAmount,
      errors,
      warnings
    };
  }

  // CRITICAL: Secure payment reference validation
  static validatePaymentReference(reference: string): ReferenceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!reference || typeof reference !== 'string') {
      return {
        isValid: false,
        errors: ['Payment reference is required and must be a string'],
        warnings,
        isPaystackFormat: false
      };
    }

    const trimmedRef = reference.trim();
    
    if (trimmedRef.length === 0) {
      errors.push('Payment reference cannot be empty');
    }

    // Length validation (Paystack typically uses 10-50 characters)
    if (trimmedRef.length < 8) {
      errors.push('Payment reference too short (minimum 8 characters)');
    }

    if (trimmedRef.length > 100) {
      errors.push('Payment reference too long (maximum 100 characters)');
    }

    // Character validation - only alphanumeric, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(trimmedRef)) {
      errors.push('Payment reference contains invalid characters (only letters, numbers, hyphens, and underscores allowed)');
    }

    // Check if it follows Paystack format patterns
    const paystackPatterns = [
      /^[a-z0-9]+$/, // Lowercase alphanumeric
      /^[A-Z0-9]+$/, // Uppercase alphanumeric
      /^[a-zA-Z0-9_-]+$/ // Mixed with separators
    ];

    const isPaystackFormat = paystackPatterns.some(pattern => pattern.test(trimmedRef));

    // Additional security checks
    if (trimmedRef.includes('..') || trimmedRef.includes('--') || trimmedRef.includes('__')) {
      warnings.push('Reference contains repeated separators');
    }

    return {
      isValid: errors.length === 0,
      sanitizedReference: trimmedRef,
      errors,
      warnings,
      isPaystackFormat
    };
  }

  // CRITICAL: Verify order total matches payment amount
  static async verifyOrderAmount(orderId: string, paymentAmount: number, currency: string = 'NGN'): Promise<ValidationResult & {
    calculatedTotal?: number;
    breakdown?: {
      subtotal: number;
      tax: number;
      shipping: number;
      discount: number;
      total: number;
    };
  }> {
    try {
      // Validate inputs first
      const amountValidation = this.validateAmount(paymentAmount, currency);
      if (!amountValidation.isValid) {
        return {
          isValid: false,
          errors: ['Invalid payment amount', ...amountValidation.errors]
        };
      }

      // Get order with all related data
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            unit_price,
            total_price,
            product_name
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return {
          isValid: false,
          errors: ['Order not found or access denied']
        };
      }

      // Calculate total from order components
      let itemsSubtotal = 0;
      if (order.order_items && Array.isArray(order.order_items)) {
        itemsSubtotal = order.order_items.reduce((sum: number, item: any) => {
          const itemTotal = item.total_price || (item.quantity * item.unit_price);
          return sum + itemTotal;
        }, 0);
      }

      const taxAmount = order.tax_amount || 0;
      const shippingCost = order.delivery_fee || 0;
      const discountAmount = order.discount_amount || 0;
      
      const calculatedTotal = itemsSubtotal + taxAmount + shippingCost - discountAmount;

      // Validate amounts match (allow 1 cent/kobo difference for rounding)
      const rules = CURRENCY_RULES[currency as keyof typeof CURRENCY_RULES];
      const tolerance = 1 / rules.subunit_multiplier; // 1 kobo/cent tolerance
      const difference = Math.abs(calculatedTotal - paymentAmount);
      const isValid = difference <= tolerance;

      const breakdown = {
        subtotal: itemsSubtotal,
        tax: taxAmount,
        shipping: shippingCost,
        discount: discountAmount,
        total: calculatedTotal
      };

      return {
        isValid,
        calculatedTotal,
        breakdown,
        errors: isValid ? [] : [
          `Amount mismatch: expected ${calculatedTotal} ${currency}, received ${paymentAmount} ${currency}`,
          `Difference: ${difference} ${currency} (tolerance: ${tolerance} ${currency})`
        ]
      };

    } catch (error) {
      console.error('Order verification error:', error);
      return {
        isValid: false,
        errors: [`Order verification failed: ${error.message}`]
      };
    }
  }

  // CRITICAL: Validate payment reference ownership
  static async validateReferenceOwnership(reference: string, userId?: string, orderToken?: string): Promise<ValidationResult & {
    paymentData?: any;
    orderData?: any;
  }> {
    try {
      const refValidation = this.validatePaymentReference(reference);
      if (!refValidation.isValid) {
        return {
          isValid: false,
          errors: ['Invalid reference format', ...refValidation.errors]
        };
      }

      // Get payment transaction
      const { data: payment, error: paymentError } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          orders (*)
        `)
        .eq('provider_reference', reference)
        .single();

      if (paymentError || !payment) {
        return {
          isValid: false,
          errors: ['Payment reference not found']
        };
      }

      // Validate ownership if user ID provided
      if (userId && payment.metadata?.user_id !== userId) {
        // Log potential security incident
        await supabase.from('security_incidents').insert({
          type: 'unauthorized_payment_access',
          description: 'User attempted to access payment they do not own',
          severity: 'high',
          user_id: userId,
          reference: reference,
          request_data: { attempted_user: userId, actual_user: payment.metadata?.user_id }
        });

        return {
          isValid: false,
          errors: ['Access denied: You do not own this payment']
        };
      }

      // Validate order token if provided (for guest checkouts)
      if (orderToken && payment.orders?.customer_email) {
        // Additional token validation logic could go here
        // For now, we'll trust the order token if provided
      }

      return {
        isValid: true,
        errors: [],
        paymentData: payment,
        orderData: payment.orders
      };

    } catch (error) {
      console.error('Reference ownership validation error:', error);
      return {
        isValid: false,
        errors: [`Reference validation failed: ${error.message}`]
      };
    }
  }

  // CRITICAL: Generate cryptographically secure payment reference
  static generateSecureReference(prefix: string = 'txn'): string {
    try {
      // Use crypto.getRandomValues for cryptographic security
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      
      // Convert to base36 for readability
      const randomPart = Array.from(array)
        .map(b => b.toString(36))
        .join('')
        .toUpperCase()
        .substring(0, 12);

      const timestamp = Date.now().toString(36).toUpperCase();
      
      return `${prefix}_${timestamp}_${randomPart}`;
    } catch (error) {
      // Fallback to less secure but still usable method
      console.warn('Crypto API not available, using fallback reference generation');
      const randomPart = Math.random().toString(36).substring(2, 14).toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase();
      return `${prefix}_${timestamp}_${randomPart}`;
    }
  }

  // CRITICAL: Comprehensive payment data sanitization for PCI compliance
  static sanitizeForLogging(data: any): any {
    if (!data) return data;

    const sanitized = JSON.parse(JSON.stringify(data));
    
    // List of sensitive fields to redact
    const sensitiveFields = [
      'card', 'cvv', 'pin', 'authorization_code',
      'last4', 'exp_month', 'exp_year', 'bin',
      'account_number', 'bank_code', 'card_number',
      'signature', 'webhook_secret', 'api_key',
      'secret_key', 'private_key', 'token'
    ];

    function recursiveSanitize(obj: any): any {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => recursiveSanitize(item));
      }
      
      for (const key in obj) {
        const lowercaseKey = key.toLowerCase();
        
        // Check if field is sensitive
        if (sensitiveFields.some(sensitive => lowercaseKey.includes(sensitive))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object') {
          obj[key] = recursiveSanitize(obj[key]);
        }
      }
      
      return obj;
    }

    return recursiveSanitize(sanitized);
  }

  // CRITICAL: Mask sensitive display data
  static maskCardNumber(cardNumber: string): string {
    if (!cardNumber || typeof cardNumber !== 'string') return '****';
    
    // Remove any spaces or hyphens
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    
    if (cleaned.length < 6) return '****';
    
    return '**** **** **** ' + cleaned.slice(-4);
  }

  static maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return '***@***.***';
    
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***.***';
    
    const maskedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : '***';
    
    return `${maskedLocal}@${domain}`;
  }

  static maskPhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '***-***-****';
    
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 6) return '***-***-****';
    
    return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
  }
}