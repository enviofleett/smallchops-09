// Checkout Error Recovery Service
// Handles error recovery, retry logic, and user guidance for checkout failures

import { logger } from '@/lib/logger';

export interface CheckoutError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  retryAfter?: number;
  userAction?: string;
}

export interface RecoveryStrategy {
  canRecover: boolean;
  action: 'retry' | 'redirect' | 'refresh' | 'contact_support';
  message: string;
  delay?: number;
}

export class CheckoutErrorRecovery {
  private static readonly ERROR_PATTERNS = {
    // Network and connectivity errors
    NETWORK_ERROR: /network|fetch|connection|timeout/i,
    
    // Rate limiting errors
    RATE_LIMITED: /rate.limit|too.many|429/i,
    
    // Validation errors
    VALIDATION_ERROR: /validation|required|invalid/i,
    
    // Payment errors
    PAYMENT_ERROR: /payment|paystack|authorization/i,
    
    // Database errors
    DATABASE_ERROR: /database|sql|constraint|foreign.key/i,
    
    // Security errors
    SECURITY_ERROR: /security|unauthorized|forbidden|csrf/i
  };

  /**
   * Analyze an error and determine recovery strategy
   */
  static analyzeError(error: any): CheckoutError {
    const errorMessage = error?.message || error?.error || 'Unknown error';
    const errorCode = error?.code || error?.error_code || 'UNKNOWN_ERROR';
    
    let recoverable = true;
    let retryAfter: number | undefined;
    let userAction: string | undefined;

    // Analyze error type and determine recoverability
    if (this.ERROR_PATTERNS.NETWORK_ERROR.test(errorMessage)) {
      userAction = 'Check your internet connection and try again';
      retryAfter = 5000; // 5 seconds
    } else if (this.ERROR_PATTERNS.RATE_LIMITED.test(errorMessage)) {
      recoverable = true;
      retryAfter = error?.retryAfter ? error.retryAfter * 1000 : 60000; // 1 minute default
      userAction = 'Please wait a moment before trying again';
    } else if (this.ERROR_PATTERNS.VALIDATION_ERROR.test(errorMessage)) {
      recoverable = true;
      retryAfter = 0;
      userAction = 'Please check your information and try again';
    } else if (this.ERROR_PATTERNS.PAYMENT_ERROR.test(errorMessage)) {
      recoverable = true;
      retryAfter = 10000; // 10 seconds
      userAction = 'Payment initialization failed. Please try again';
    } else if (this.ERROR_PATTERNS.DATABASE_ERROR.test(errorMessage)) {
      recoverable = false;
      userAction = 'System error occurred. Please contact support';
    } else if (this.ERROR_PATTERNS.SECURITY_ERROR.test(errorMessage)) {
      recoverable = false;
      userAction = 'Security verification failed. Please refresh and try again';
    }

    return {
      code: errorCode,
      message: errorMessage,
      details: error?.details || error,
      recoverable,
      retryAfter,
      userAction
    };
  }

  /**
   * Get recovery strategy for a checkout error
   */
  static getRecoveryStrategy(checkoutError: CheckoutError): RecoveryStrategy {
    if (!checkoutError.recoverable) {
      return {
        canRecover: false,
        action: 'contact_support',
        message: checkoutError.userAction || 'Please contact our support team for assistance'
      };
    }

    // Determine best recovery action
    if (checkoutError.code === 'VALIDATION_FAILED') {
      return {
        canRecover: true,
        action: 'retry',
        message: 'Please review your information and try again',
        delay: 0
      };
    }

    if (checkoutError.code === 'RATE_LIMITED') {
      return {
        canRecover: true,
        action: 'retry',
        message: `Please wait ${Math.ceil((checkoutError.retryAfter || 60000) / 1000)} seconds before trying again`,
        delay: checkoutError.retryAfter || 60000
      };
    }

    if (this.ERROR_PATTERNS.NETWORK_ERROR.test(checkoutError.message)) {
      return {
        canRecover: true,
        action: 'retry',
        message: 'Connection issue detected. Retrying...',
        delay: checkoutError.retryAfter || 5000
      };
    }

    if (this.ERROR_PATTERNS.SECURITY_ERROR.test(checkoutError.message)) {
      return {
        canRecover: true,
        action: 'refresh',
        message: 'Security token expired. Please refresh the page and try again'
      };
    }

    // Default recovery strategy
    return {
      canRecover: true,
      action: 'retry',
      message: checkoutError.userAction || 'Something went wrong. Please try again',
      delay: checkoutError.retryAfter || 3000
    };
  }

  /**
   * Execute recovery action with appropriate user feedback
   */
  static async executeRecovery(
    strategy: RecoveryStrategy,
    retryCallback?: () => Promise<void>
  ): Promise<void> {
    logger.info('Executing checkout recovery strategy', { strategy });

    switch (strategy.action) {
      case 'retry':
        if (strategy.delay && strategy.delay > 0) {
          // Show countdown to user
          await this.delayWithCountdown(strategy.delay);
        }
        if (retryCallback) {
          await retryCallback();
        }
        break;

      case 'refresh':
        // Trigger page refresh after user confirmation
        if (confirm(strategy.message + '\n\nRefresh the page now?')) {
          window.location.reload();
        }
        break;

      case 'redirect':
        // Redirect to cart or appropriate page
        window.location.href = '/cart';
        break;

      case 'contact_support':
        // Log error for support team
        logger.error('Checkout requires support intervention', { strategy });
        break;
    }
  }

  /**
   * Show countdown delay to user
   */
  private static async delayWithCountdown(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const seconds = Math.ceil(ms / 1000);
      let remaining = seconds;

      const interval = setInterval(() => {
        if (remaining <= 0) {
          clearInterval(interval);
          resolve();
        } else {
          // This would ideally update a UI component showing the countdown
          console.log(`Retrying in ${remaining} seconds...`);
          remaining--;
        }
      }, 1000);
    });
  }

  /**
   * Generate user-friendly error message
   */
  static getUserFriendlyMessage(error: CheckoutError): string {
    const baseMessages = {
      VALIDATION_FAILED: 'Please check your information and try again.',
      RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
      NETWORK_ERROR: 'Connection problem. Please check your internet and try again.',
      PAYMENT_ERROR: 'Payment processing issue. Please try again.',
      DATABASE_ERROR: 'System temporarily unavailable. Please try again later.',
      SECURITY_ERROR: 'Security verification failed. Please refresh and try again.',
    };

    return error.userAction || 
           baseMessages[error.code as keyof typeof baseMessages] || 
           'Something went wrong. Please try again or contact support.';
  }

  /**
   * Track error for analytics and monitoring
   */
  static trackError(error: CheckoutError, context: any = {}): void {
    logger.error('Checkout error tracked', {
      error_code: error.code,
      error_message: error.message,
      recoverable: error.recoverable,
      retry_after: error.retryAfter,
      context,
      timestamp: new Date().toISOString()
    });

    // Track in analytics if available
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Checkout Error', {
        error_code: error.code,
        recoverable: error.recoverable,
        ...context
      });
    }
  }
}