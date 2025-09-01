/**
 * Centralized Error Reporting System
 * Production-ready error tracking and monitoring
 */

interface ErrorReport {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: string;
  errorId: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  buildVersion?: string;
  errorCategory: string;
  retryCount?: number;
  componentStack?: string;
}

interface ErrorMetrics {
  errorCount: number;
  timeoutCount: number;
  networkErrorCount: number;
  lastErrorTime: number;
}

class ErrorReportingService {
  private static instance: ErrorReportingService;
  private metrics: ErrorMetrics = {
    errorCount: 0,
    timeoutCount: 0,
    networkErrorCount: 0,
    lastErrorTime: 0
  };

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * Generate unique error ID
   */
  generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Categorize error based on message and context
   */
  categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('component load timeout')) {
      this.metrics.timeoutCount++;
      return 'timeout';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
      this.metrics.networkErrorCount++;
      return 'network';
    }
    if (message.includes('chunk') || message.includes('loading')) {
      return 'chunk_load';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return 'auth';
    }
    if (message.includes('syntax') || message.includes('unexpected token')) {
      return 'syntax';
    }
    if (message.includes('cannot read property') || message.includes('undefined')) {
      return 'runtime';
    }
    
    return 'unknown';
  }

  /**
   * Create comprehensive error report
   */
  createErrorReport(
    error: Error, 
    context?: string, 
    componentStack?: string,
    retryCount?: number
  ): ErrorReport {
    const errorId = this.generateErrorId();
    const errorCategory = this.categorizeError(error);
    
    this.metrics.errorCount++;
    this.metrics.lastErrorTime = Date.now();

    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      buildVersion: import.meta.env.VITE_BUILD_VERSION || 'unknown',
      errorCategory,
      retryCount,
      componentStack
    };
  }

  /**
   * Report error to monitoring services
   */
  async reportError(errorReport: ErrorReport): Promise<void> {
    try {
      // Log to console in development
      if (import.meta.env.DEV) {
        console.group(`🚨 Error Report: ${errorReport.context || 'Unknown'}`);
        console.error('Error Details:', errorReport);
        console.groupEnd();
      }

      // In production, send to monitoring service
      if (import.meta.env.PROD) {
        await this.sendToMonitoringService(errorReport);
      }

      // Store locally for debugging
      this.storeErrorLocally(errorReport);
      
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  /**
   * Send error to external monitoring service
   * Replace with your preferred service (Sentry, LogRocket, etc.)
   */
  private async sendToMonitoringService(errorReport: ErrorReport): Promise<void> {
    try {
      // This is where you'd integrate with your monitoring service
      // Example integrations:
      
      // Sentry
      // Sentry.captureException(new Error(errorReport.error.message), {
      //   extra: errorReport,
      //   tags: { category: errorReport.errorCategory }
      // });
      
      // LogRocket
      // LogRocket.captureException(new Error(errorReport.error.message));
      
      // Custom endpoint
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // });

      console.log('📊 Production Error Logged:', errorReport.errorId);
      
    } catch (error) {
      console.error('Failed to send error to monitoring service:', error);
    }
  }

  /**
   * Store error locally for debugging
   */
  private storeErrorLocally(errorReport: ErrorReport): void {
    try {
      const errors = this.getStoredErrors();
      errors.push(errorReport);
      
      // Keep only last 50 errors
      const recentErrors = errors.slice(-50);
      localStorage.setItem('app_errors', JSON.stringify(recentErrors));
      
    } catch (error) {
      console.warn('Failed to store error locally:', error);
    }
  }

  /**
   * Get stored errors from localStorage
   */
  getStoredErrors(): ErrorReport[] {
    try {
      const stored = localStorage.getItem('app_errors');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear stored errors
   */
  clearStoredErrors(): void {
    localStorage.removeItem('app_errors');
    this.metrics = {
      errorCount: 0,
      timeoutCount: 0,
      networkErrorCount: 0,
      lastErrorTime: 0
    };
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current user ID (implement based on your auth system)
   */
  private getCurrentUserId(): string | undefined {
    try {
      // Replace with your auth system
      // const user = getCurrentUser();
      // return user?.id;
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get or create session ID
   */
  private getSessionId(): string {
    try {
      let sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('session_id', sessionId);
      }
      return sessionId;
    } catch {
      return 'unknown_session';
    }
  }

  /**
   * Check if error rate is too high (circuit breaker pattern)
   */
  isErrorRateTooHigh(): boolean {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.metrics.errorCount > 10 && this.metrics.lastErrorTime > fiveMinutesAgo;
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(errorCategory: string, error: Error): string {
    switch (errorCategory) {
      case 'timeout':
        return 'The page is taking longer than usual to load. Please wait a moment and try again.';
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'chunk_load':
        return 'There was an update to the app. Please refresh the page.';
      case 'auth':
        return 'You may need to log in again to continue.';
      case 'syntax':
        return 'A technical error occurred. Our team has been notified.';
      case 'runtime':
        return 'Something went wrong. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }
  }
}

export const errorReporting = ErrorReportingService.getInstance();
export type { ErrorReport, ErrorMetrics };
