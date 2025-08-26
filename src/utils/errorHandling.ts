/**
 * Safe Error Handling Utilities
 * Provides consistent error message extraction and prevents type errors
 */

export const safeErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  
  if (error && typeof error === 'object') {
    const errorObj = error as any;
    
    // Safe message extraction with null checks
    let message = errorObj.message || errorObj.error || errorObj.msg;
    
    if (typeof message === 'string') {
      return message;
    }
  }
  
  return 'An unexpected error occurred';
};

/**
 * Safe includes check utility to prevent "Cannot read properties of undefined" errors
 */
export const safeStringIncludes = (str: unknown, searchTerm: string): boolean => {
  return typeof str === 'string' && str.includes && str.includes(searchTerm);
};

/**
 * Enhanced error handler for database-specific errors
 */
export const handleDatabaseError = (error: unknown, onError?: (message: string) => void) => {
  const message = safeErrorMessage(error);
  
  // Check for common database column errors
  if (safeStringIncludes(message, 'created_at') && safeStringIncludes(message, 'does not exist')) {
    const dbMessage = 'Database schema issue detected. Please contact support if this persists.';
    onError?.(dbMessage);
    return dbMessage;
  }
  
  if (safeStringIncludes(message, 'column') && safeStringIncludes(message, 'does not exist')) {
    const schemaMessage = 'Database column missing. The system is attempting to recover automatically.';
    onError?.(schemaMessage);
    return schemaMessage;
  }
  
  if (safeStringIncludes(message, 'relation') && safeStringIncludes(message, 'does not exist')) {
    const tableMessage = 'Database table not found. Please refresh the page and try again.';
    onError?.(tableMessage);
    return tableMessage;
  }
  
  // Default to generic database error
  const genericMessage = 'Database connection issue. Please try again in a moment.';
  onError?.(genericMessage);
  return genericMessage;
};

/**
 * Enhanced error handler for payment-specific errors
 */
export const handlePaymentError = (error: unknown, onError?: (message: string) => void) => {
  const message = safeErrorMessage(error);
  
  // Safe includes usage for specific error handling
  if (safeStringIncludes(message, 'requires_auth')) {
    const authMessage = 'Please log in to continue with checkout';
    onError?.(authMessage);
    return authMessage;
  }
  
  if (safeStringIncludes(message, 'guest_checkout')) {
    const guestMessage = 'Guest checkout is not available. Please log in to continue.';
    onError?.(guestMessage);
    return guestMessage;
  }

  if (safeStringIncludes(message, '403') || safeStringIncludes(message, 'Forbidden')) {
    const permissionMessage = 'You do not have permission to perform this action';
    onError?.(permissionMessage);
    return permissionMessage;
  }
  
  // Default error handling
  onError?.(message);
  return message;
};

/**
 * Payment response normalization with safe fallbacks
 */
export const normalizePaymentResponse = (response: any) => {
  try {
    // Handle nested response structures
    const paymentData = response?.payment || response?.data || response;
    
    // Priority: payment_url > authorization_url > construct from access_code
    let paymentUrl = paymentData?.payment_url || paymentData?.authorization_url;
    
    // Fallback: construct from access_code
    if (!paymentUrl && paymentData?.access_code) {
      paymentUrl = `https://checkout.paystack.com/${paymentData.access_code}`;
      console.log('Using access_code fallback for payment URL');
    }
    
    if (!paymentUrl) {
      throw new Error('No payment URL available');
    }
    
    return {
      payment_url: paymentUrl,
      authorization_url: paymentData?.authorization_url,
      reference: paymentData?.reference,
      access_code: paymentData?.access_code,
      order_id: response?.order_id,
      order_number: response?.order_number
    };
    
  } catch (error) {
    console.error('Payment data normalization failed:', error);
    throw new Error('Invalid payment response format');
  }
};