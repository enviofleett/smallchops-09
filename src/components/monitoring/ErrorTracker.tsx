import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ErrorData {
  message: string;
  stack?: string;
  url: string;
  line?: number;
  column?: number;
  timestamp: number;
  userAgent: string;
  userId?: string;
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: ErrorData[] = [];

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  init() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });
    });

    // React error boundary integration
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      if (errorMessage.includes('React') || errorMessage.includes('Component')) {
        this.captureError({
          message: errorMessage,
          url: window.location.href,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        });
      }
      originalConsoleError.apply(console, args);
    };
  }

  captureError(errorData: ErrorData) {
    this.errors.push(errorData);
    console.error('Error captured:', errorData);
    
    // Send to Supabase for storage
    this.sendToSupabase(errorData);
  }

  private async sendToSupabase(errorData: ErrorData) {
    try {
      await supabase.from('performance_analytics').insert({
        endpoint: 'client_error',
        method: 'ERROR',
        response_time_ms: 0,
        status_code: 0,
        user_agent: errorData.userAgent,
        ip_address: null,
        error_details: {
          message: errorData.message,
          stack: errorData.stack,
          url: errorData.url,
          line: errorData.line,
          column: errorData.column,
          timestamp: errorData.timestamp
        }
      });
    } catch (error) {
      console.warn('Failed to send error to Supabase:', error);
    }
  }

  getErrors() {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
  }
}

export const ErrorTrackerComponent: React.FC = () => {
  useEffect(() => {
    const tracker = ErrorTracker.getInstance();
    tracker.init();
  }, []);

  return null; // This component doesn't render anything
};

export { ErrorTracker };