import { logger } from '@/lib/logger';

export interface EdgeFunctionMetrics {
  functionName: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: string;
  lastErrorTime?: Date;
}

/**
 * Monitors edge function calls and tracks performance metrics
 */
export class EdgeFunctionMonitor {
  private static metrics: Map<string, EdgeFunctionMetrics> = new Map();

  static trackCall(functionName: string, success: boolean, responseTime: number, error?: string) {
    const current = this.metrics.get(functionName) || {
      functionName,
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    };

    current.totalCalls++;
    
    if (success) {
      current.successCount++;
    } else {
      current.errorCount++;
      current.lastError = error;
      current.lastErrorTime = new Date();
    }

    // Update rolling average
    current.averageResponseTime = 
      (current.averageResponseTime * (current.totalCalls - 1) + responseTime) / current.totalCalls;

    this.metrics.set(functionName, current);

    // Log if error rate is high
    const errorRate = current.errorCount / current.totalCalls;
    if (errorRate > 0.2 && current.totalCalls >= 5) {
      logger.warn(`High error rate for ${functionName}: ${(errorRate * 100).toFixed(1)}%`, {
        metrics: current
      });
    }
  }

  static getMetrics(functionName?: string): EdgeFunctionMetrics[] {
    if (functionName) {
      const metric = this.metrics.get(functionName);
      return metric ? [metric] : [];
    }
    return Array.from(this.metrics.values());
  }

  static reset(functionName?: string) {
    if (functionName) {
      this.metrics.delete(functionName);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Wrapper for edge function calls with automatic monitoring
   */
  static async monitorCall<T>(
    functionName: string,
    operation: () => Promise<T>,
    context: string = ''
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const responseTime = performance.now() - startTime;
      
      this.trackCall(functionName, true, responseTime);
      logger.debug(`✅ ${functionName} success`, { context, responseTime: Math.round(responseTime) });
      
      return result;
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      const errorMessage = error?.message || 'Unknown error';
      
      this.trackCall(functionName, false, responseTime, errorMessage);
      logger.error(`❌ ${functionName} failed`, error, context);
      
      throw error;
    }
  }
}

/**
 * Quick helper to wrap supabase function calls with monitoring
 */
export const monitoredInvoke = async (
  supabase: any,
  functionName: string,
  params: any,
  context: string = ''
) => {
  return EdgeFunctionMonitor.monitorCall(
    functionName,
    () => supabase.functions.invoke(functionName, params),
    context
  );
};