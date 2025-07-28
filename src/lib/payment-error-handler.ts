export interface PaymentErrorInfo {
  userMessage: string;
  category: string;
  actionable: boolean;
  retryable: boolean;
  suggestions: string[];
}

export class PaymentErrorHandler {
  static categorizeError(error: any): PaymentErrorInfo {
    const errorMessage = error.message || error.toString().toLowerCase();
    
    // Network/API errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || 
        errorMessage.includes('connection') || errorMessage.includes('fetch')) {
      return {
        userMessage: 'Connection issue detected. Please check your internet and try again.',
        category: 'network',
        actionable: true,
        retryable: true,
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Switch to mobile data if using WiFi'
        ]
      };
    }
    
    // Card-related errors
    if (errorMessage.includes('card') || errorMessage.includes('declined') || 
        errorMessage.includes('invalid card') || errorMessage.includes('expired')) {
      return {
        userMessage: 'Your card was declined. Please try a different card or contact your bank.',
        category: 'card_declined',
        actionable: true,
        retryable: false,
        suggestions: [
          'Try a different card',
          'Use bank transfer instead',
          'Contact your bank to authorize the payment',
          'Check your card details and try again'
        ]
      };
    }
    
    // Insufficient funds
    if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
      return {
        userMessage: 'Insufficient funds. Please check your account balance or try a different payment method.',
        category: 'insufficient_funds',
        actionable: true,
        retryable: false,
        suggestions: [
          'Check your account balance',
          'Try a different payment method',
          'Use a different card',
          'Contact your bank for assistance'
        ]
      };
    }
    
    // Amount issues
    if (errorMessage.includes('amount') || errorMessage.includes('minimum') || 
        errorMessage.includes('maximum') || errorMessage.includes('invalid amount')) {
      return {
        userMessage: 'Payment amount is invalid. Please check the order total and try again.',
        category: 'invalid_amount',
        actionable: true,
        retryable: true,
        suggestions: [
          'Refresh the page and try again',
          'Contact support if the issue persists',
          'Check that your order items are still available'
        ]
      };
    }
    
    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many') || 
        errorMessage.includes('attempts')) {
      return {
        userMessage: 'Too many attempts. Please wait a moment before trying again.',
        category: 'rate_limit',
        actionable: true,
        retryable: true,
        suggestions: [
          'Wait 60 seconds before trying again',
          'Clear your browser cache',
          'Try using a different payment method'
        ]
      };
    }
    
    // Authentication/authorization errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication') || 
        errorMessage.includes('login')) {
      return {
        userMessage: 'Authentication issue. Please log in again and try your payment.',
        category: 'auth_error',
        actionable: true,
        retryable: true,
        suggestions: [
          'Log out and log back in',
          'Clear your browser cache and cookies',
          'Try using a private/incognito browser window'
        ]
      };
    }
    
    // Bank/transfer specific errors
    if (errorMessage.includes('bank') || errorMessage.includes('transfer') || 
        errorMessage.includes('ussd')) {
      return {
        userMessage: 'Bank transfer issue. Please try a different payment method or contact your bank.',
        category: 'bank_error',
        actionable: true,
        retryable: true,
        suggestions: [
          'Try card payment instead',
          'Contact your bank for assistance',
          'Check if online banking is working',
          'Try again later'
        ]
      };
    }
    
    // Configuration errors (admin should handle these)
    if (errorMessage.includes('configuration') || errorMessage.includes('setup') || 
        errorMessage.includes('integration')) {
      return {
        userMessage: 'Payment system temporarily unavailable. Please contact support.',
        category: 'config_error',
        actionable: false,
        retryable: false,
        suggestions: [
          'Contact customer support',
          'Try again later',
          'Use alternative payment method if available'
        ]
      };
    }
    
    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || 
        errorMessage.includes('required')) {
      return {
        userMessage: 'Please check your payment details and try again.',
        category: 'validation_error',
        actionable: true,
        retryable: true,
        suggestions: [
          'Verify all required fields are filled',
          'Check your email and phone number format',
          'Ensure your card details are correct',
          'Refresh the page and try again'
        ]
      };
    }
    
    // Default for unknown errors
    return {
      userMessage: 'Payment could not be processed. Please try again or contact support.',
      category: 'unknown',
      actionable: false,
      retryable: true,
      suggestions: [
        'Try again in a few minutes',
        'Use a different payment method',
        'Contact customer support if the issue persists',
        'Clear your browser cache and try again'
      ]
    };
  }
  
  static getPaymentMethodSuggestion(errorInfo: PaymentErrorInfo): string[] {
    const suggestions: string[] = [...errorInfo.suggestions];
    
    // Add payment method specific suggestions
    if (errorInfo.category === 'card_declined') {
      suggestions.unshift('Try bank transfer instead of card payment');
    }
    
    if (errorInfo.category === 'network') {
      suggestions.push('Try USSD payment which works offline');
    }
    
    if (errorInfo.category === 'insufficient_funds') {
      suggestions.unshift('Consider using bank transfer for larger amounts');
    }
    
    return suggestions.slice(0, 4); // Limit to 4 suggestions for UI
  }
  
  static formatErrorForUser(error: any): {
    title: string;
    message: string;
    suggestions: string[];
    canRetry: boolean;
    severity: 'low' | 'medium' | 'high';
  } {
    const errorInfo = this.categorizeError(error);
    const suggestions = this.getPaymentMethodSuggestion(errorInfo);
    
    let severity: 'low' | 'medium' | 'high' = 'medium';
    
    if (errorInfo.category === 'config_error') {
      severity = 'high';
    } else if (errorInfo.retryable) {
      severity = 'low';
    }
    
    return {
      title: this.getCategoryTitle(errorInfo.category),
      message: errorInfo.userMessage,
      suggestions,
      canRetry: errorInfo.retryable,
      severity
    };
  }
  
  private static getCategoryTitle(category: string): string {
    const titles: Record<string, string> = {
      network: 'Connection Issue',
      card_declined: 'Card Declined',
      insufficient_funds: 'Insufficient Funds',
      invalid_amount: 'Invalid Amount',
      rate_limit: 'Too Many Attempts',
      auth_error: 'Authentication Required',
      bank_error: 'Bank Transfer Issue',
      config_error: 'Service Unavailable',
      validation_error: 'Invalid Details',
      unknown: 'Payment Failed'
    };
    
    return titles[category] || 'Payment Error';
  }
  
  static shouldShowRetryButton(error: any): boolean {
    const errorInfo = this.categorizeError(error);
    return errorInfo.retryable;
  }
  
  static getRetryDelay(error: any): number {
    const errorInfo = this.categorizeError(error);
    
    // Different retry delays based on error type
    if (errorInfo.category === 'rate_limit') {
      return 60000; // 60 seconds
    } else if (errorInfo.category === 'network') {
      return 5000; // 5 seconds
    } else if (errorInfo.category === 'bank_error') {
      return 30000; // 30 seconds
    }
    
    return 10000; // 10 seconds default
  }
}