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
 * Payment response normalization with safe fallbacks - FIXED for new backend structure
 */
export const normalizePaymentResponse = (response: any) => {
  try {
    console.log('🔧 Normalizing payment response:', response);
    
    // Handle both new and legacy response structures
    const paymentData = response?.payment || response;
    
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
      // Handle both root-level and nested order data
      order_id: response?.order_id || response?.order?.id,
      order_number: response?.order_number || response?.order?.order_number,
      amount: response?.total_amount || response?.amount || response?.order?.total_amount
    };
    
  } catch (error) {
    console.error('Payment data normalization failed:', error);
    throw new Error('Invalid payment response format');
  }
};