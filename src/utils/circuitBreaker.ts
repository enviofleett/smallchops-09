/**
 * Circuit Breaker Pattern Implementation for Database Operations
 * Prevents cascading failures by temporarily stopping requests after failures
 */

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutMs: number;
  retryTimeoutMs: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

export class CircuitBreaker {
  private failureThreshold: number;
  private timeoutMs: number;
  private retryTimeoutMs: number;
  private failureCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private state: CircuitBreakerState = 'closed';
  private serviceName: string;

  constructor(
    serviceName: string, 
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.serviceName = serviceName;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.timeoutMs = config.timeoutMs ?? 60000; // 1 minute
    this.retryTimeoutMs = config.retryTimeoutMs ?? 5000; // 5 seconds
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        console.log(`🔄 Circuit breaker [${this.serviceName}] moving to HALF_OPEN state`);
      } else {
        const nextRetry = this.getNextRetryTime();
        throw new Error(
          `Circuit breaker is OPEN for ${this.serviceName}. Next retry: ${nextRetry.toISOString()}`
        );
      }
    }

    try {
      const startTime = Date.now();
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise()
      ]);
      
      await this.onSuccess();
      return result;
    } catch (error) {
      await this.onFailure(error);
      throw error;
    }
  }

  private async createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
  }

  private async onSuccess(): Promise<void> {
    this.failureCount = 0;
    this.lastSuccessTime = new Date();
    this.state = 'closed';
    
    // Update database state (async, don't block)
    this.updateDatabaseState().catch(err => 
      console.warn(`Failed to update circuit breaker state: ${err.message}`)
    );
    
    console.log(`✅ Circuit breaker [${this.serviceName}] SUCCESS - reset to CLOSED`);
  }

  private async onFailure(error: any): Promise<void> {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    console.error(`❌ Circuit breaker [${this.serviceName}] FAILURE ${this.failureCount}/${this.failureThreshold}:`, error.message);
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.error(`🚨 Circuit breaker [${this.serviceName}] OPENED - too many failures`);
    }
    
    // Update database state (async, don't block)
    this.updateDatabaseState().catch(err => 
      console.warn(`Failed to update circuit breaker state: ${err.message}`)
    );
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime.getTime() > this.retryTimeoutMs;
  }

  private getNextRetryTime(): Date {
    if (!this.lastFailureTime) return new Date();
    return new Date(this.lastFailureTime.getTime() + this.retryTimeoutMs);
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.state === 'open' ? this.getNextRetryTime() : undefined
    };
  }

  /**
   * Check if the circuit breaker allows execution
   */
  canExecute(): boolean {
    if (this.state === 'closed' || this.state === 'half-open') {
      return true;
    }
    
    if (this.state === 'open') {
      return this.shouldAttemptReset();
    }
    
    return false;
  }

  /**
   * Manually reset the circuit breaker
   */
  async reset(): Promise<void> {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.state = 'closed';
    
    await this.updateDatabaseState();
    console.log(`🔧 Circuit breaker [${this.serviceName}] manually reset to CLOSED`);
  }

  /**
   * Update circuit breaker state in database for persistence
   */
  private async updateDatabaseState(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Client-side: send to edge function
      try {
        await fetch('/api/circuit-breaker-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime?.toISOString(),
            lastSuccessTime: this.lastSuccessTime?.toISOString(),
            nextRetryTime: this.state === 'open' ? this.getNextRetryTime().toISOString() : null,
            failureThreshold: this.failureThreshold,
            timeoutSeconds: Math.round(this.retryTimeoutMs / 1000)
          })
        });
      } catch (error) {
        console.warn('Failed to persist circuit breaker state:', error);
      }
    }
  }

  /**
   * Load circuit breaker state from database
   */
  static async loadFromDatabase(serviceName: string): Promise<CircuitBreaker | null> {
    try {
      const response = await fetch(`/api/circuit-breaker-state/${serviceName}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const breaker = new CircuitBreaker(serviceName, {
        failureThreshold: data.failure_threshold,
        timeoutMs: data.timeout_seconds * 1000
      });
      
      breaker.state = data.state;
      breaker.failureCount = data.failure_count;
      breaker.lastFailureTime = data.last_failure_time ? new Date(data.last_failure_time) : undefined;
      breaker.lastSuccessTime = data.last_success_time ? new Date(data.last_success_time) : undefined;
      
      return breaker;
    } catch (error) {
      console.warn('Failed to load circuit breaker state:', error);
      return null;
    }
  }
}

// Global circuit breakers for common services
export const circuitBreakers = {
  database: new CircuitBreaker('database_operations', { failureThreshold: 3, timeoutMs: 30000 }),
  orderUpdate: new CircuitBreaker('order_update_operations', { failureThreshold: 5, timeoutMs: 10000 }),
  emailService: new CircuitBreaker('email_service', { failureThreshold: 3, timeoutMs: 15000 }),
  webhooks: new CircuitBreaker('webhook_delivery', { failureThreshold: 2, timeoutMs: 5000 })
};

/**
 * Execute database operation with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: keyof typeof circuitBreakers,
  operation: () => Promise<T>
): Promise<T> {
  return circuitBreakers[serviceName].execute(operation);
}

/**
 * Get status of all circuit breakers
 */
export function getAllCircuitBreakerStatus(): Record<string, CircuitBreakerMetrics> {
  return Object.entries(circuitBreakers).reduce((acc, [name, breaker]) => {
    acc[name] = breaker.getMetrics();
    return acc;
  }, {} as Record<string, CircuitBreakerMetrics>);
}