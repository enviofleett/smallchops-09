/**
 * Emergency Stabilization: Robust Error Handler for Admin Orders Manager
 * Implements circuit breaker pattern and comprehensive error recovery
 */

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  timeoutMs: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  retryAfter?: number;
  details?: any;
}

export class OrderManagerErrorHandler {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      circuitBreakerThreshold: 5,
      timeoutMs: 30000,
      ...config
    };
  }

  /**
   * Circuit breaker check - prevents cascading failures
   */
  isCircuitOpen(): boolean {
    if (this.failureCount < this.config.circuitBreakerThreshold) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    const cooldownPeriod = 60000; // 1 minute

    if (timeSinceLastFailure > cooldownPeriod) {
      this.failureCount = 0; // Reset circuit breaker
      return false;
    }

    return true;
  }

  /**
   * Record a failure for circuit breaker tracking
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  /**
   * Record a success - resets circuit breaker
   */
  recordSuccess(): void {
    this.failureCount = 0;
  }

  /**
   * Handle database constraint violations with specific error mapping
   */
  handleDatabaseError(error: any): ErrorResponse {
    console.error('Database error occurred:', error);

    // Handle enum constraint violations
    if (error.code === '22P02' && error.message?.includes('invalid input value for enum')) {
      return {
        success: false,
        error: 'Invalid status value provided. Please use a valid order status.',
        errorCode: 'INVALID_ENUM_VALUE',
        details: { originalError: error.message }
      };
    }

    // Handle duplicate key violations
    if (error.code === '23505') {
      return {
        success: false,
        error: 'Duplicate entry detected. Operation already completed.',
        errorCode: 'DUPLICATE_ENTRY',
        details: { constraint: error.constraint }
      };
    }

    // Handle foreign key violations
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Related record not found. Please check the referenced data.',
        errorCode: 'FOREIGN_KEY_VIOLATION',
        details: { constraint: error.constraint }
      };
    }

    // Handle not null violations
    if (error.code === '23502') {
      return {
        success: false,
        error: 'Required field missing. Please provide all necessary information.',
        errorCode: 'MISSING_REQUIRED_FIELD',
        details: { column: error.column }
      };
    }

    // Generic database error
    return {
      success: false,
      error: 'Database operation failed. Please try again.',
      errorCode: 'DATABASE_ERROR',
      details: { code: error.code, message: error.message }
    };
  }

  /**
   * Handle authentication and authorization errors
   */
  handleAuthError(error: any): ErrorResponse {
    console.error('Authentication error:', error);

    if (error.message?.includes('Invalid authentication')) {
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
        errorCode: 'AUTH_INVALID'
      };
    }

    if (error.message?.includes('Admin access required')) {
      return {
        success: false,
        error: 'Administrative privileges required.',
        errorCode: 'AUTH_INSUFFICIENT'
      };
    }

    return {
      success: false,
      error: 'Authentication error occurred.',
      errorCode: 'AUTH_ERROR',
      details: { message: error.message }
    };
  }

  /**
   * Handle network and timeout errors
   */
  handleNetworkError(error: any): ErrorResponse {
    console.error('Network error:', error);

    if (error.message?.includes('timeout')) {
      return {
        success: false,
        error: 'Operation timed out. Please try again.',
        errorCode: 'TIMEOUT',
        retryAfter: 5000
      };
    }

    if (error.message?.includes('network') || error.message?.includes('connection')) {
      return {
        success: false,
        error: 'Network connection error. Please check your connection.',
        errorCode: 'NETWORK_ERROR',
        retryAfter: 2000
      };
    }

    return {
      success: false,
      error: 'Connection error occurred.',
      errorCode: 'CONNECTION_ERROR'
    };
  }

  /**
   * Central error handling with categorization
   */
  handleError(error: any, operation: string): ErrorResponse {
    console.error(`Error in operation "${operation}":`, error);

    // Record failure for circuit breaker
    this.recordFailure();

    // Circuit breaker check
    if (this.isCircuitOpen()) {
      return {
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        retryAfter: 60000
      };
    }

    // Categorize and handle specific error types
    if (error.code && error.code.startsWith('23')) {
      return this.handleDatabaseError(error);
    }

    if (error.message?.includes('auth') || error.message?.includes('Unauthorized')) {
      return this.handleAuthError(error);
    }

    if (error.message?.includes('timeout') || error.message?.includes('network')) {
      return this.handleNetworkError(error);
    }

    // Generic error handling
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
      errorCode: 'GENERIC_ERROR',
      details: {
        operation,
        message: error.message,
        code: error.code
      }
    };
  }

  /**
   * Wrap async operations with timeout and error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | ErrorResponse> {
    try {
      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation "${operationName}" timed out`)), this.config.timeoutMs);
      });

      const result = await Promise.race([operation(), timeoutPromise]);
      this.recordSuccess();
      return result;
    } catch (error) {
      return this.handleError(error, operationName);
    }
  }
}

/**
 * Standardized CORS error response
 */
export function createErrorResponse(
  errorHandler: OrderManagerErrorHandler,
  error: any,
  operation: string,
  corsHeaders: Record<string, string>
): Response {
  const errorResponse = errorHandler.handleError(error, operation);
  
  return new Response(JSON.stringify(errorResponse), {
    status: getHttpStatusFromErrorCode(errorResponse.errorCode),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Map error codes to appropriate HTTP status codes
 */
function getHttpStatusFromErrorCode(errorCode?: string): number {
  switch (errorCode) {
    case 'AUTH_INVALID':
    case 'AUTH_INSUFFICIENT':
      return 401;
    case 'INVALID_ENUM_VALUE':
    case 'MISSING_REQUIRED_FIELD':
    case 'FOREIGN_KEY_VIOLATION':
      return 400;
    case 'DUPLICATE_ENTRY':
      return 409;
    case 'TIMEOUT':
    case 'NETWORK_ERROR':
    case 'CONNECTION_ERROR':
      return 503;
    case 'CIRCUIT_BREAKER_OPEN':
      return 503;
    default:
      return 500;
  }
}