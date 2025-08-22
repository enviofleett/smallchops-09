// Enhanced Email Retry and Circuit Breaker System
// Provides resilient email delivery with intelligent retry logic

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms before attempting to close circuit
  monitorWindow: number; // Time window for tracking failures
}

export class EmailRetryManager {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  };

  private static readonly CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitorWindow: 300000 // 5 minutes
  };

  private static circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private static lastFailureTime = 0;
  private static failureCount = 0;
  private static failures: number[] = [];

  // Execute with retry logic and circuit breaker
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: { recipient?: string; templateKey?: string } = {}
  ): Promise<T> {
    const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config };
    
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      throw new Error('Email service circuit breaker is open - service temporarily unavailable');
    }

    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Mark circuit breaker state if this is not the first attempt
        if (attempt > 0) {
          this.circuitState = 'half-open';
        }

        const result = await operation();
        
        // Success - reset circuit breaker
        this.onSuccess();
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        console.log(`[EMAIL_RETRY] Attempt ${attempt + 1} failed for ${context.recipient || 'unknown'}: ${error.message}`);
        
        // Record failure for circuit breaker
        this.onFailure();
        
        // Check if we should retry
        if (attempt < retryConfig.maxRetries && this.shouldRetry(error as Error)) {
          const delay = this.calculateDelay(attempt, retryConfig);
          console.log(`[EMAIL_RETRY] Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    console.error(`[EMAIL_RETRY] All ${retryConfig.maxRetries + 1} attempts failed for ${context.recipient || 'unknown'}`);
    throw lastError!;
  }

  // Determine if an error is retryable
  private static shouldRetry(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Don't retry these types of errors
    const nonRetryableErrors = [
      'invalid email',
      'authentication failed',
      'rate limit exceeded',
      'email address is suppressed',
      'template not found',
      'recipient not found',
      'domain not found'
    ];

    if (nonRetryableErrors.some(err => message.includes(err))) {
      return false;
    }

    // Retry these types of errors
    const retryableErrors = [
      'connection timeout',
      'connection closed',
      'temporary failure',
      'service unavailable',
      'network',
      'timeout',
      'connection refused',
      'dns',
      'smtp error 4' // 4xx SMTP errors are typically temporary
    ];

    return retryableErrors.some(err => message.includes(err));
  }

  // Calculate delay with exponential backoff and jitter
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    delay = Math.min(delay, config.maxDelay);
    
    if (config.jitter) {
      // Add random jitter to prevent thundering herd
      delay *= (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  // Sleep utility
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker logic
  private static isCircuitClosed(): boolean {
    const now = Date.now();
    
    // Clean old failures outside monitor window
    this.failures = this.failures.filter(
      timestamp => now - timestamp < this.CIRCUIT_BREAKER_CONFIG.monitorWindow
    );
    
    switch (this.circuitState) {
      case 'closed':
        return this.failures.length < this.CIRCUIT_BREAKER_CONFIG.failureThreshold;
        
      case 'open':
        // Check if we should transition to half-open
        if (now - this.lastFailureTime > this.CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
          console.log('[EMAIL_CIRCUIT_BREAKER] Transitioning to half-open state');
          this.circuitState = 'half-open';
          return true;
        }
        return false;
        
      case 'half-open':
        return true; // Allow one request through
        
      default:
        return true;
    }
  }

  private static onSuccess(): void {
    console.log('[EMAIL_CIRCUIT_BREAKER] Operation successful - closing circuit');
    this.circuitState = 'closed';
    this.failures = [];
    this.failureCount = 0;
  }

  private static onFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.failureCount++;
    this.lastFailureTime = now;
    
    // Check if we should open the circuit
    if (this.failures.length >= this.CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      console.log(`[EMAIL_CIRCUIT_BREAKER] Opening circuit after ${this.failures.length} failures`);
      this.circuitState = 'open';
    }
  }

  // Get circuit breaker status
  static getCircuitStatus(): {
    state: string;
    failureCount: number;
    nextRetry?: Date;
  } {
    const status = {
      state: this.circuitState,
      failureCount: this.failures.length
    };

    if (this.circuitState === 'open') {
      const nextRetry = new Date(this.lastFailureTime + this.CIRCUIT_BREAKER_CONFIG.recoveryTimeout);
      return { ...status, nextRetry };
    }

    return status;
  }

  // Reset circuit breaker (for admin use)
  static resetCircuitBreaker(): void {
    console.log('[EMAIL_CIRCUIT_BREAKER] Circuit breaker manually reset');
    this.circuitState = 'closed';
    this.failures = [];
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}