import { logger } from '@/lib/logger';
import { showErrorToast } from './errorToastHandler';

export interface EdgeFunctionError {
  message: string;
  code?: string;
  details?: any;
  isRetryable?: boolean;
}

export class EdgeFunctionErrorHandler {
  /**
   * Categorizes edge function errors and determines if they're retryable
   */
  static categorizeError(error: any): EdgeFunctionError {
    const message = error?.message || error?.error || 'Unknown error';
    const code = error?.code;

    // Network/Connection errors - usually retryable
    if (message.includes('non-2xx status code') || 
        message.includes('500') || 
        message.includes('502') || 
        message.includes('503') || 
        message.includes('504')) {
      return {
        message: 'Service temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE',
        isRetryable: true,
        details: error
      };
    }

    // Timeout errors - retryable
    if (message.includes('timeout') || message.includes('TimeoutError')) {
      return {
        message: 'Request timed out. Please try again.',
        code: 'TIMEOUT',
        isRetryable: true,
        details: error
      };
    }

    // Authentication errors - not retryable
    if (message.includes('Unauthorized') || 
        message.includes('Forbidden') || 
        message.includes('auth') ||
        code === 'AUTH_TOKEN_MISSING' ||
        code === 'AUTH_TOKEN_INVALID') {
      return {
        message: 'Authentication failed. Please log in again.',
        code: 'AUTH_FAILED',
        isRetryable: false,
        details: error
      };
    }

    // Validation errors - not retryable
    if (message.includes('required') || 
        message.includes('invalid') || 
        message.includes('not found') ||
        code === 'VALIDATION_ERROR') {
      return {
        message: message,
        code: 'VALIDATION_ERROR',
        isRetryable: false,
        details: error
      };
    }

    // Database constraint errors - usually not retryable
    if (message.includes('duplicate key') || 
        message.includes('foreign key') || 
        message.includes('constraint')) {
      return {
        message: 'Data conflict detected. Please refresh and try again.',
        code: 'DATA_CONFLICT',
        isRetryable: false,
        details: error
      };
    }

    // Default to retryable for unknown errors
    return {
      message: message || 'An unexpected error occurred',
      code: code || 'UNKNOWN_ERROR',
      isRetryable: true,
      details: error
    };
  }

  /**
   * Handles edge function errors with appropriate logging and user feedback
   */
  static handleError(error: any, context: string = 'Edge Function') {
    const categorizedError = this.categorizeError(error);
    
    // Log the error with context
    logger.error(`${context} Error`, categorizedError.details, context);

    // Show user-friendly toast
    showErrorToast(categorizedError.message, {
      title: `${context} Error`,
      retryAction: categorizedError.isRetryable ? () => {
        logger.info('User clicked retry for', context);
      } : undefined
    });

    return categorizedError;
  }

  /**
   * Exponential backoff utility for retries
   */
  static async withExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const categorizedError = this.categorizeError(error);
        
        // Don't retry non-retryable errors
        if (!categorizedError.isRetryable) {
          throw error;
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries - 1) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
          logger.debug(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}