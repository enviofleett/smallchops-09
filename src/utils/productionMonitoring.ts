/**
 * Production monitoring utilities for error tracking and performance monitoring
 */

interface ErrorReport {
  errorId: string;
  message: string;
  stack?: string;
  context?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
}

interface PerformanceReport {
  metric: string;
  value: number;
  timestamp: string;
  context?: string;
}

class ProductionMonitoring {
  private sessionId: string;
  private userId?: string;
  private errorQueue: ErrorReport[] = [];
  private performanceQueue: PerformanceReport[] = [];
  private isFlushingQueue = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
    this.setupPerformanceObserver();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        'Global Promise Rejection'
      );
    });

    // Catch global JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(
        new Error(`${event.message} at ${event.filename}:${event.lineno}`),
        'Global JavaScript Error'
      );
    });
  }

  private setupPerformanceObserver() {
    try {
      // Observe Core Web Vitals
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.reportPerformance('page_load_time', entry.duration || 0);
            } else if (entry.entryType === 'largest-contentful-paint') {
              this.reportPerformance('lcp', entry.startTime);
            } else if (entry.entryType === 'first-input') {
              // Cast to PerformanceEventTiming for first-input entries
              const firstInputEntry = entry as any;
              const processingTime = firstInputEntry.processingStart ? 
                firstInputEntry.processingStart - entry.startTime : 0;
              this.reportPerformance('fid', processingTime);
            }
          }
        });

        observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input'] });
      }
    } catch (error) {
      console.warn('Performance observer setup failed:', error);
    }
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  reportError(error: Error, context?: string) {
    const errorReport: ErrorReport = {
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.errorQueue.push(errorReport);
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.group('🚨 Production Monitoring - Error Report');
      console.error('Error:', errorReport);
      console.groupEnd();
    }

    // Flush queue periodically or when it gets large
    if (this.errorQueue.length >= 5 || !this.isFlushingQueue) {
      this.flushErrorQueue();
    }
  }

  reportPerformance(metric: string, value: number, context?: string) {
    const performanceReport: PerformanceReport = {
      metric,
      value,
      timestamp: new Date().toISOString(),
      context,
    };

    this.performanceQueue.push(performanceReport);

    // Log significant performance issues
    if (metric === 'lcp' && value > 2500) {
      console.warn(`⚠️ Poor LCP performance: ${value}ms`);
    } else if (metric === 'fid' && value > 100) {
      console.warn(`⚠️ Poor FID performance: ${value}ms`);
    }

    // Flush performance data less frequently
    if (this.performanceQueue.length >= 10) {
      this.flushPerformanceQueue();
    }
  }

  private async flushErrorQueue() {
    if (this.isFlushingQueue || this.errorQueue.length === 0) return;
    
    this.isFlushingQueue = true;
    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // In a real app, you would send this to your monitoring service
      // For now, we'll just log structured data that could be collected
      console.group('📊 Error Batch Report');
      console.table(errors.map(e => ({
        errorId: e.errorId,
        message: e.message.substring(0, 50) + '...',
        context: e.context,
        timestamp: e.timestamp,
      })));
      console.groupEnd();

      // Example of how you might send to a monitoring service:
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ errors })
      // });

    } catch (error) {
      console.error('Failed to flush error queue:', error);
      // Put errors back in queue for retry
      this.errorQueue.unshift(...errors);
    } finally {
      this.isFlushingQueue = false;
    }
  }

  private async flushPerformanceQueue() {
    const metrics = [...this.performanceQueue];
    this.performanceQueue = [];

    try {
      console.group('📈 Performance Metrics');
      console.table(metrics);
      console.groupEnd();

      // Example monitoring service call:
      // await fetch('/api/performance', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ metrics })
      // });

    } catch (error) {
      console.error('Failed to flush performance queue:', error);
    }
  }

  // Public method to manually flush all queues
  async flush() {
    await Promise.all([
      this.flushErrorQueue(),
      this.flushPerformanceQueue(),
    ]);
  }
}

// Create singleton instance
export const productionMonitoring = new ProductionMonitoring();

// Export convenience functions
export const reportError = (error: Error, context?: string) => 
  productionMonitoring.reportError(error, context);

export const reportPerformance = (metric: string, value: number, context?: string) => 
  productionMonitoring.reportPerformance(metric, value, context);

export const setMonitoringUserId = (userId: string) => 
  productionMonitoring.setUserId(userId);

// Auto-flush on page unload
window.addEventListener('beforeunload', () => {
  productionMonitoring.flush();
});