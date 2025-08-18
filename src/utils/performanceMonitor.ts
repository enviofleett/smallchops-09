import { UsageOptimizer } from './usageOptimizer';

interface PerformanceMetrics {
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
  averageQueryTime: number;
  errors: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    queryCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageQueryTime: 0,
    errors: 0,
  };

  private static queryTimes: number[] = [];

  static trackQuery(startTime: number, fromCache: boolean = false) {
    const duration = Date.now() - startTime;
    
    this.metrics.queryCount++;
    
    if (fromCache) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
      this.queryTimes.push(duration);
      
      // Keep only last 100 query times for average calculation
      if (this.queryTimes.length > 100) {
        this.queryTimes.shift();
      }
      
      this.metrics.averageQueryTime = 
        this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
    }

    // Log slow queries
    if (duration > 2000) {
      console.warn(`🐌 Slow query detected: ${duration}ms`);
    }

    // Report every 50 queries
    if (this.metrics.queryCount % 50 === 0) {
      this.reportMetrics();
    }
  }

  static trackError(error: Error, context: string) {
    this.metrics.errors++;
    console.error(`📊 Performance error in ${context}:`, error);
  }

  static reportMetrics() {
    const cacheHitRate = this.metrics.queryCount > 0 
      ? (this.metrics.cacheHits / this.metrics.queryCount * 100).toFixed(1)
      : '0';

    console.log(`📊 Performance Metrics:
    Total Queries: ${this.metrics.queryCount}
    Cache Hit Rate: ${cacheHitRate}%
    Avg Query Time: ${this.metrics.averageQueryTime.toFixed(0)}ms
    Errors: ${this.metrics.errors}
    `);

    // Get Supabase usage stats
    const usageStats = UsageOptimizer.getUsageStats();
    console.log('🔧 Supabase Usage:', usageStats);
  }

  static getMetrics(): PerformanceMetrics & { cacheHitRate: number } {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.queryCount > 0 
        ? this.metrics.cacheHits / this.metrics.queryCount 
        : 0,
    };
  }

  static reset() {
    this.metrics = {
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      errors: 0,
    };
    this.queryTimes = [];
  }
}

// Global performance monitoring
window.addEventListener('beforeunload', () => {
  PerformanceMonitor.reportMetrics();
});
