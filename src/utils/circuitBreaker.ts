/**
 * Circuit breaker implementation for preventing cascading failures
 * and providing graceful degradation when services are unavailable
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Service unavailable, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service is restored
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  recoveryTimeout: number;       // Time to wait before attempting recovery (ms)
  monitoringWindow: number;      // Time window for failure counting (ms)
  successThreshold: number;      // Successes needed in half-open state to close
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  nextAttempt: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private nextAttempt: number = 0;
  private failureWindow: number[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringWindow: 300000, // 5 minutes
      successThreshold: 2,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      } else {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        console.log('🔄 Circuit breaker transitioning to HALF_OPEN - testing service');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failures = 0;
    this.failureWindow = [];

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      console.log(`✅ Circuit breaker success ${this.successes}/${this.config.successThreshold}`);
      
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        console.log('🟢 Circuit breaker CLOSED - service restored');
      }
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures++;
    this.failureWindow.push(now);

    // Clean old failures outside monitoring window
    this.failureWindow = this.failureWindow.filter(
      timestamp => now - timestamp < this.config.monitoringWindow
    );

    console.log(`❌ Circuit breaker failure ${this.failureWindow.length}/${this.config.failureThreshold}`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test - back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttempt = now + this.config.recoveryTimeout;
      console.log('🔴 Circuit breaker back to OPEN - recovery failed');
    } else if (this.failureWindow.length >= this.config.failureThreshold) {
      // Too many failures in window - open circuit
      this.state = CircuitState.OPEN;
      this.nextAttempt = now + this.config.recoveryTimeout;
      console.log('🔴 Circuit breaker OPEN - too many failures');
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureWindow.length,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt
    };
  }

  isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }
    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }
    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttempt) {
      return true;
    }
    return false;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.nextAttempt = 0;
    this.failureWindow = [];
    console.log('🔄 Circuit breaker manually reset');
  }
}

// Global circuit breakers for different services
export const dashboardApiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  successThreshold: 2
});

export const authApiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 2,
  recoveryTimeout: 60000, // 1 minute
  successThreshold: 1
});

// Utility function to create a circuit breaker for any service
export function createCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  const breaker = new CircuitBreaker(config);
  console.log(`🛡️ Created circuit breaker for ${name}`);
  return breaker;
}