import { supabase } from '@/integrations/supabase/client';
import { withTimeout, isNetworkError, getRetryDelay, isOnline } from '@/utils/networkUtils';

interface ResilientQueryOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  fallbackData?: any;
  priority?: 'low' | 'normal' | 'high';
}

interface QueryMetrics {
  startTime: number;
  attempts: number;
  errors: string[];
}

// Circuit breaker pattern for preventing cascade failures
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds

  canExecute(): boolean {
    if (this.failures < this.threshold) return true;
    
    const now = Date.now();
    if (now - this.lastFailureTime > this.timeout) {
      this.failures = 0; // Reset on timeout
      return true;
    }
    
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}

const circuitBreaker = new CircuitBreaker();

export class ResilientSupabaseClient {
  private static metricsMap = new Map<string, QueryMetrics>();

  static async executeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    options: ResilientQueryOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    const {
      timeout = 8000,
      maxRetries = 2,
      retryDelay = 1000,
      fallbackData = null,
      priority = 'normal'
    } = options;

    // Skip if circuit breaker is open
    if (!circuitBreaker.canExecute()) {
      console.warn('Circuit breaker open - using fallback data');
      return { data: fallbackData, error: null };
    }

    // Skip if offline (for non-critical queries)
    if (!isOnline() && priority === 'low') {
      return { data: fallbackData, error: new Error('Offline - using cached data') };
    }

    const queryId = this.generateQueryId();
    const metrics: QueryMetrics = {
      startTime: Date.now(),
      attempts: 0,
      errors: []
    };

    this.metricsMap.set(queryId, metrics);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      metrics.attempts = attempt + 1;

      try {
        const result = await withTimeout(queryFn(), timeout);
        
        if (result.error) {
          throw new Error(result.error.message || 'Database error');
        }

        // Success - record metrics and return
        circuitBreaker.recordSuccess();
        this.recordSuccess(queryId, metrics);
        return result;

      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        metrics.errors.push(errorMessage);

        console.warn(`Query attempt ${attempt + 1} failed:`, errorMessage);

        // Don't retry on client errors or auth errors
        if (error?.status >= 400 && error?.status < 500) {
          this.recordFailure(queryId, metrics, error);
          circuitBreaker.recordFailure();
          return { data: fallbackData, error };
        }

        // Don't retry on network errors for low priority queries
        if (isNetworkError(error) && priority === 'low') {
          this.recordFailure(queryId, metrics, error);
          return { data: fallbackData, error };
        }

        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          const delay = getRetryDelay(attempt, retryDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    const finalError = new Error(`Query failed after ${maxRetries + 1} attempts`);
    this.recordFailure(queryId, metrics, finalError);
    circuitBreaker.recordFailure();
    
    return { data: fallbackData, error: finalError };
  }

  static async safeQuery<T>(
    table: string, 
    queryBuilder: (query: any) => any,
    options: ResilientQueryOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return this.executeQuery(async () => {
      const query = (supabase as any).from(table);
      return await queryBuilder(query);
    }, options);
  }

  static async safeInvoke<T>(
    functionName: string,
    args?: any,
    options: ResilientQueryOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return this.executeQuery(async () => {
      return await supabase.functions.invoke(functionName, args);
    }, options);
  }

  static async safeSingle<T>(
    table: string,
    queryBuilder: (query: any) => any,
    options: ResilientQueryOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return this.executeQuery(async () => {
      const query = (supabase as any).from(table);
      return await queryBuilder(query).maybeSingle(); // Use maybeSingle to prevent errors
    }, options);
  }

  private static generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static recordSuccess(queryId: string, metrics: QueryMetrics): void {
    const duration = Date.now() - metrics.startTime;
    console.debug(`✅ Query ${queryId} succeeded in ${duration}ms after ${metrics.attempts} attempts`);
    this.metricsMap.delete(queryId);
  }

  private static recordFailure(queryId: string, metrics: QueryMetrics, error: any): void {
    const duration = Date.now() - metrics.startTime;
    console.error(`❌ Query ${queryId} failed after ${duration}ms and ${metrics.attempts} attempts:`, {
      error: error?.message,
      attempts: metrics.attempts,
      errors: metrics.errors
    });
    this.metricsMap.delete(queryId);
  }

  static getCircuitBreakerStatus() {
    return {
      isOpen: !circuitBreaker.canExecute(),
      failures: (circuitBreaker as any).failures,
      lastFailure: (circuitBreaker as any).lastFailureTime
    };
  }
}

// Backward compatibility exports
export const resilientSupabase = ResilientSupabaseClient;
export default ResilientSupabaseClient;