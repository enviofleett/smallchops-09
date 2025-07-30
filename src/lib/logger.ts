/**
 * Production-safe logging utility
 * Conditionally logs based on environment
 */

const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log info messages - only in development
   */
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log warnings - only in development
   */
  warn: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Log errors - always log errors for monitoring
   */
  error: (message: string, error?: any, context?: string) => {
    const errorData = {
      message,
      error: error?.message || error,
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    // Always log errors to console
    console.error(`[ERROR] ${message}`, errorData);

    // In production, could send to monitoring service
    if (isProduction) {
      // TODO: Send to monitoring service like Sentry, LogRocket, etc.
      // Example: analytics.track('error', errorData);
    }
  },

  /**
   * Log debug messages - only in development
   */
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Log performance metrics - only in development
   */
  performance: (label: string, duration: number) => {
    if (isDevelopment) {
      console.log(`[PERF] ${label}: ${duration}ms`);
    }
  }
};

/**
 * Performance measurement utility
 */
export const measure = {
  start: (label: string): (() => void) => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      logger.performance(label, Math.round(duration));
    };
  }
};

export default logger;