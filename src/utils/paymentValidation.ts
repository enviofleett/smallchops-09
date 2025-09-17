/**
 * Production-Ready Payment Validation Utilities
 * Provides robust validation for payment processing with proper enum handling
 */

export interface PaymentValidationResult {
  isValid: boolean;
  sanitizedData: any;
  errors: string[];
  warnings: string[];
}

// Valid enum values from database
export const VALID_ORDER_STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 
  'delivered', 'cancelled', 'refunded', 'completed', 'returned'
] as const;

export const VALID_PAYMENT_STATUSES = [
  'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
] as const;

export type OrderStatus = typeof VALID_ORDER_STATUSES[number];
export type PaymentStatus = typeof VALID_PAYMENT_STATUSES[number];

/**
 * Validates and sanitizes order status with proper fallbacks
 */
export function validateOrderStatus(status: any): OrderStatus {
  if (!status || status === 'null' || status === null || status === undefined) {
    console.warn('⚠️ Invalid order status received, defaulting to pending:', status);
    return 'pending';
  }

  const normalizedStatus = String(status).toLowerCase().trim();
  
  if (VALID_ORDER_STATUSES.includes(normalizedStatus as OrderStatus)) {
    return normalizedStatus as OrderStatus;
  }

  // Handle legacy/invalid status mappings
  const statusMappings: Record<string, OrderStatus> = {
    'dispatched': 'out_for_delivery', // Legacy mapping
    'shipped': 'out_for_delivery',
    'processing': 'preparing',
    'complete': 'completed',
    'failed': 'cancelled' // Safe fallback for failed orders
  };

  if (statusMappings[normalizedStatus]) {
    console.warn(`🔄 Mapping legacy status "${status}" to "${statusMappings[normalizedStatus]}"`);
    return statusMappings[normalizedStatus];
  }

  console.error(`❌ Invalid order status: ${status}, using fallback: 'pending'`);
  return 'pending';
}

/**
 * Validates and sanitizes payment status with proper fallbacks
 */
export function validatePaymentStatus(status: any): PaymentStatus {
  if (!status || status === 'null' || status === null || status === undefined) {
    console.warn('⚠️ Invalid payment status received, defaulting to pending:', status);
    return 'pending';
  }

  const normalizedStatus = String(status).toLowerCase().trim();
  
  if (VALID_PAYMENT_STATUSES.includes(normalizedStatus as PaymentStatus)) {
    return normalizedStatus as PaymentStatus;
  }

  // Handle common payment status variations
  const statusMappings: Record<string, PaymentStatus> = {
    'success': 'paid',
    'successful': 'paid',
    'completed': 'paid',
    'error': 'failed',
    'cancelled': 'failed',
    'timeout': 'failed'
  };

  if (statusMappings[normalizedStatus]) {
    console.warn(`🔄 Mapping payment status "${status}" to "${statusMappings[normalizedStatus]}"`);
    return statusMappings[normalizedStatus];
  }

  console.error(`❌ Invalid payment status: ${status}, using fallback: 'failed'`);
  return 'failed';
}

/**
 * Comprehensive payment callback data validation
 */
export function validatePaymentCallback(callbackData: any): PaymentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sanitizedData: any = { ...callbackData };

  try {
    // Validate required fields
    if (!callbackData.reference && !callbackData.trxref) {
      errors.push('Missing payment reference');
    } else {
      sanitizedData.reference = callbackData.reference || callbackData.trxref;
    }

    // Validate and sanitize order status if present
    if (callbackData.order_status !== undefined) {
      const originalStatus = callbackData.order_status;
      sanitizedData.order_status = validateOrderStatus(originalStatus);
      
      if (sanitizedData.order_status !== originalStatus) {
        warnings.push(`Order status normalized from "${originalStatus}" to "${sanitizedData.order_status}"`);
      }
    }

    // Validate and sanitize payment status if present
    if (callbackData.payment_status !== undefined) {
      const originalStatus = callbackData.payment_status;
      sanitizedData.payment_status = validatePaymentStatus(originalStatus);
      
      if (sanitizedData.payment_status !== originalStatus) {
        warnings.push(`Payment status normalized from "${originalStatus}" to "${sanitizedData.payment_status}"`);
      }
    }

    // Validate amount if present
    if (callbackData.amount !== undefined) {
      const amount = parseFloat(String(callbackData.amount));
      if (isNaN(amount) || amount <= 0) {
        errors.push('Invalid amount value');
      } else {
        sanitizedData.amount = amount;
      }
    }

    // Validate order_id if present
    if (callbackData.order_id && typeof callbackData.order_id !== 'string') {
      sanitizedData.order_id = String(callbackData.order_id);
      warnings.push('Order ID converted to string');
    }

    return {
      isValid: errors.length === 0,
      sanitizedData,
      errors,
      warnings
    };

  } catch (error) {
    console.error('❌ Payment validation error:', error);
    return {
      isValid: false,
      sanitizedData: callbackData,
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Logs validation results for monitoring and debugging
 */
export function logValidationResult(result: PaymentValidationResult, context: string) {
  if (result.isValid) {
    console.log(`✅ ${context}: Validation passed`);
    if (result.warnings.length > 0) {
      console.warn(`⚠️ ${context} warnings:`, result.warnings);
    }
  } else {
    console.error(`❌ ${context}: Validation failed`);
    console.error('Errors:', result.errors);
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }
  }
}

/**
 * Safe enum value extraction for database operations
 */
export function extractSafeEnumValues(data: any) {
  return {
    order_status: data.order_status ? validateOrderStatus(data.order_status) : undefined,
    payment_status: data.payment_status ? validatePaymentStatus(data.payment_status) : undefined,
    reference: data.reference || data.trxref || null,
    amount: data.amount ? parseFloat(String(data.amount)) : undefined,
    order_id: data.order_id ? String(data.order_id) : undefined
  };
}