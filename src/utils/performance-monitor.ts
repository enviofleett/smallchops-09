// Enhanced performance monitoring for production stability

interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTimes: Record<string, number[]>;
  errorCounts: Record<string, number>;
  memoryUsage?: number;
  connectionType?: string;
}

class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    pageLoadTime: 0,
    apiResponseTimes: {},
    errorCounts: {},
  };

  private static observers: PerformanceObserver[] = [];

  static init() {
    if (typeof window === 'undefined') return;

    // Monitor page load performance
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      this.metrics.pageLoadTime = loadTime;
      
      if (loadTime > 3000) {
        console.warn(`🐌 Slow page load detected: ${loadTime.toFixed(2)}ms`);
      }
    });

    // Monitor long tasks that block the main thread
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) {
              console.warn(`🚨 Long task detected: ${entry.duration.toFixed(2)}ms`, entry);
            }
          });
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // Long task API not supported
      }

      // Monitor Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          if (lastEntry.startTime > 2500) {
            console.warn(`🐌 Slow LCP detected: ${lastEntry.startTime.toFixed(2)}ms`);
          }
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        // LCP API not supported
      }
    }

    // Monitor memory usage if available
    if ((navigator as any).deviceMemory) {
      this.metrics.memoryUsage = (navigator as any).deviceMemory;
    }

    // Monitor connection type
    if ((navigator as any).connection) {
      this.metrics.connectionType = (navigator as any).connection.effectiveType;
    }
  }

  static recordApiCall(endpoint: string, duration: number) {
    if (!this.metrics.apiResponseTimes[endpoint]) {
      this.metrics.apiResponseTimes[endpoint] = [];
    }
    
    this.metrics.apiResponseTimes[endpoint].push(duration);
    
    // Keep only last 10 measurements per endpoint
    if (this.metrics.apiResponseTimes[endpoint].length > 10) {
      this.metrics.apiResponseTimes[endpoint].shift();
    }

    // Warn on slow API calls
    if (duration > 5000) {
      console.warn(`🐌 Slow API call to ${endpoint}: ${duration.toFixed(2)}ms`);
    }
  }

  static recordError(category: string) {
    if (!this.metrics.errorCounts[category]) {
      this.metrics.errorCounts[category] = 0;
    }
    this.metrics.errorCounts[category]++;

    // Warn on high error rates
    if (this.metrics.errorCounts[category] > 5) {
      console.warn(`🚨 High error rate in ${category}: ${this.metrics.errorCounts[category]} errors`);
    }
  }

  static getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  static getAverageApiTime(endpoint: string): number {
    const times = this.metrics.apiResponseTimes[endpoint];
    if (!times || times.length === 0) return 0;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  static cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  PerformanceMonitor.init();
}

export default PerformanceMonitor;
