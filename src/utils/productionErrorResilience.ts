import { toast } from 'sonner';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  exponentialBackoff: boolean;
  timeout: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  exponentialBackoff: true,
  timeout: 30000, // 30 seconds
};

/**
 * Production-grade retry mechanism with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: string = 'operation'
): Promise<T> {
  const { maxAttempts, baseDelay, exponentialBackoff, timeout } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Attempting ${context} (${attempt}/${maxAttempts})`);
      
      // Set operation timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout);
      });
      
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      console.log(`✅ ${context} succeeded on attempt ${attempt}`);
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.log(`❌ ${context} failed on attempt ${attempt}: ${lastError.message}`);
      
      // Don't retry on authentication errors
      if (lastError.message.includes('authentication') || 
          lastError.message.includes('unauthorized') ||
          lastError.message.includes('Rate limit exceeded')) {
        break;
      }
      
      // Don't delay after the last attempt
      if (attempt < maxAttempts) {
        const delay = exponentialBackoff 
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay;
        
        console.log(`⏱️ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ ${context} failed after ${maxAttempts} attempts`);
  throw lastError;
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>, context: string = 'operation'): Promise<T> {
    if (this.isOpen) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceLastFailure < this.timeout) {
        throw new Error(`Circuit breaker is open for ${context}. Try again later.`);
      } else {
        // Half-open state - attempt to reset
        this.isOpen = false;
        this.failureCount = 0;
        console.log(`🔄 Circuit breaker half-open for ${context}`);
      }
    }
    
    try {
      const result = await operation();
      
      // Success - reset failure count
      if (this.failureCount > 0) {
        console.log(`✅ Circuit breaker reset for ${context}`);
        this.failureCount = 0;
      }
      
      return result;
      
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.threshold) {
        this.isOpen = true;
        console.log(`🔴 Circuit breaker opened for ${context} after ${this.failureCount} failures`);
        toast.error(`Service temporarily unavailable. Retrying automatically...`);
      }
      
      throw error;
    }
  }
  
  get status() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Global circuit breaker instances for different services
 */
export const circuitBreakers = {
  adminOrders: new CircuitBreaker(3, 30000), // 3 failures, 30 second timeout
  webSocket: new CircuitBreaker(2, 60000),   // 2 failures, 1 minute timeout
  emailService: new CircuitBreaker(5, 120000) // 5 failures, 2 minute timeout
};

/**
 * Enhanced error classifier for production debugging
 */
export function classifyError(error: any): {
  type: 'network' | 'authentication' | 'validation' | 'server' | 'timeout' | 'rate_limit' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userMessage: string;
} {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('network') || message.includes('fetch')) {
    return {
      type: 'network',
      severity: 'medium',
      recoverable: true,
      userMessage: 'Network connection issue. Retrying automatically...'
    };
  }
  
  if (message.includes('authentication') || message.includes('unauthorized')) {
    return {
      type: 'authentication',
      severity: 'high',
      recoverable: false,
      userMessage: 'Session expired. Please refresh the page and login again.'
    };
  }
  
  if (message.includes('rate limit')) {
    return {
      type: 'rate_limit',
      severity: 'medium',
      recoverable: true,
      userMessage: 'Too many requests. Please wait a moment before trying again.'
    };
  }
  
  if (message.includes('validation') || message.includes('invalid')) {
    return {
      type: 'validation',
      severity: 'low',
      recoverable: false,
      userMessage: 'Invalid data provided. Please check your input and try again.'
    };
  }
  
  if (message.includes('timeout')) {
    return {
      type: 'timeout',
      severity: 'medium',
      recoverable: true,
      userMessage: 'Request timed out. Retrying automatically...'
    };
  }
  
  if (message.includes('500') || message.includes('server error')) {
    return {
      type: 'server',
      severity: 'high',
      recoverable: true,
      userMessage: 'Server error occurred. Our team has been notified.'
    };
  }
  
  return {
    type: 'unknown',
    severity: 'medium',
    recoverable: true,
    userMessage: 'An unexpected error occurred. Please try again.'
  };
}

/**
 * Production-ready error handler with automatic recovery
 */
export async function handleProductionError<T>(
  operation: () => Promise<T>,
  context: string,
  circuitBreaker?: CircuitBreaker,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  const executeWithCircuitBreaker = circuitBreaker 
    ? (op: () => Promise<T>) => circuitBreaker.execute(op, context)
    : (op: () => Promise<T>) => op();
  
  try {
    return await retryWithBackoff(
      () => executeWithCircuitBreaker(operation),
      retryConfig,
      context
    );
  } catch (error) {
    const classification = classifyError(error);
    
    console.error(`❌ Production error in ${context}:`, {
      error: error.message,
      type: classification.type,
      severity: classification.severity,
      recoverable: classification.recoverable
    });
    
    // Show user-friendly error message
    toast.error(classification.userMessage);
    
    // Re-throw for upstream handling
    throw error;
  }
}