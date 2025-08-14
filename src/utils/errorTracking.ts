export class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: Array<{ error: Error; timestamp: Date; url: string }> = [];

  static getInstance() {
    if (!this.instance) {
      this.instance = new ErrorTracker();
    }
    return this.instance;
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupGlobalErrorHandlers();
    }
  }

  private setupGlobalErrorHandlers() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), 'global_error');
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), 'unhandled_promise');
    });

    // Capture React hydration errors specifically
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('Hydration') || message.includes('Text content does not match')) {
        this.trackError(new Error(message), 'hydration_error');
      }
      originalConsoleError.apply(console, args);
    };
  }

  trackError(error: Error, context: string) {
    const errorInfo = {
      error,
      timestamp: new Date(),
      url: window.location.href,
      context,
      userAgent: navigator.userAgent
    };

    this.errors.push(errorInfo);
    
    // Send to monitoring service
    this.sendToMonitoring(errorInfo);

    // Keep only last 50 errors to prevent memory issues
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
  }

  private async sendToMonitoring(errorInfo: any) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorInfo)
      });
    } catch (err) {
      console.warn('Failed to send error to monitoring:', err);
    }
  }

  getRecentErrors() {
    return this.errors.slice(-10);
  }
}

// Initialize on app start
if (typeof window !== 'undefined') {
  ErrorTracker.getInstance();
}
