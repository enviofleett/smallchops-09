/**
 * Robust Error Handling Utilities for Production
 * Provides comprehensive error handling, logging, and recovery mechanisms
 */

import { AppError, ApiResponse } from '@/types';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for better classification
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database'
}

// Custom error classes for different types of errors
export class ApplicationError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.timestamp = new Date().toISOString();
    this.context = context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApplicationError);
    }
  }
}

export class NetworkError extends ApplicationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', ErrorSeverity.HIGH, ErrorCategory.NETWORK, context);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', ErrorSeverity.LOW, ErrorCategory.VALIDATION, { field });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', ErrorSeverity.HIGH, ErrorCategory.AUTHENTICATION);
    this.name = 'AuthenticationError';
  }
}

export class PaymentError extends ApplicationError {
  constructor(message: string, paymentContext?: Record<string, any>) {
    super(message, 'PAYMENT_ERROR', ErrorSeverity.HIGH, ErrorCategory.EXTERNAL_API, paymentContext);
    this.name = 'PaymentError';
  }
}

// Error logging interface
interface ErrorLogger {
  log(error: ApplicationError): void;
  logCritical(error: ApplicationError): void;
}

// Production error logger
class ProductionErrorLogger implements ErrorLogger {
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  log(error: ApplicationError): void {
    const errorData = {
      ...error,
      sessionId: this.sessionId,
      userId: this.userId,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // In development, log to console
    if (import.meta.env.DEV) {
      console.group(`🚨 Error [${error.severity.toUpperCase()}]`);
      console.error('Message:', error.message);
      console.error('Code:', error.code);
      console.error('Category:', error.category);
      console.error('Context:', error.context);
      console.error('Stack:', error.stack);
      console.groupEnd();
    }

    // In production, send to monitoring service
    if (import.meta.env.PROD) {
      this.sendToMonitoringService(errorData);
    }
  }

  logCritical(error: ApplicationError): void {
    // Always log critical errors
    this.log(error);
    
    // Additional critical error handling
    if (import.meta.env.PROD) {
      // Could trigger alerts, notifications, etc.
      this.triggerCriticalAlert(error);
    }
  }

  private async sendToMonitoringService(errorData: any): Promise<void> {
    try {
      // Implementation would depend on your monitoring service
      // Example: Sentry, LogRocket, custom endpoint, etc.
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (loggingError) {
      // Fallback: don't let logging errors break the app
      console.error('Failed to log error to monitoring service:', loggingError);
    }
  }

  private triggerCriticalAlert(error: ApplicationError): void {
    // Implementation for critical alerts
    console.error('CRITICAL ERROR DETECTED:', error);
  }
}

// Global error logger instance
export const errorLogger = new ProductionErrorLogger();

// Async operation wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = error instanceof ApplicationError 
      ? error 
      : new ApplicationError(
          error instanceof Error ? error.message : 'Unknown error occurred',
          'OPERATION_ERROR',
          ErrorSeverity.MEDIUM,
          ErrorCategory.SYSTEM,
          { context, originalError: error }
        );

    errorLogger.log(appError);
    throw appError;
  }
}

// API call wrapper with standardized error handling
export async function apiCall<T>(
  apiFunction: () => Promise<T>,
  errorContext?: string
): Promise<ApiResponse<T>> {
  try {
    const data = await apiFunction();
    return {
      success: true,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API call failed';
    const appError = new NetworkError(message, { context: errorContext });
    
    errorLogger.log(appError);
    
    return {
      success: false,
      error: message,
    };
  }
}

// Retry mechanism for failed operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        const retryError = new ApplicationError(
          `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
          'RETRY_EXHAUSTED',
          ErrorSeverity.HIGH,
          ErrorCategory.SYSTEM,
          { attempts: maxRetries, lastError: lastError.message }
        );
        
        errorLogger.log(retryError);
        throw retryError;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError!;
}

// Error boundary helper for React components
export function createErrorBoundaryHandler(componentName: string) {
  return (error: Error, errorInfo: any) => {
    const boundaryError = new ApplicationError(
      `Error in ${componentName}: ${error.message}`,
      'COMPONENT_ERROR',
      ErrorSeverity.HIGH,
      ErrorCategory.SYSTEM,
      { componentName, errorInfo }
    );
    
    errorLogger.logCritical(boundaryError);
  };
}

// Validation error helper
export function createValidationErrors(errors: Record<string, string>): ValidationError[] {
  return Object.entries(errors).map(([field, message]) => 
    new ValidationError(message, field)
  );
}

// Type guard for application errors
export function isApplicationError(error: any): error is ApplicationError {
  return error instanceof ApplicationError;
}

// Error recovery utilities
export class ErrorRecovery {
  static handleNetworkError(error: NetworkError): void {
    // Could implement network recovery strategies
    console.warn('Network error detected, implementing recovery strategy');
  }

  static handleAuthError(error: AuthenticationError): void {
    // Redirect to login or refresh token
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  static handlePaymentError(error: PaymentError): void {
    // Payment-specific recovery logic
    console.warn('Payment error detected, user should retry or contact support');
  }
}

// Global error handler setup
export function setupGlobalErrorHandling(): void {
  if (typeof window !== 'undefined') {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = new ApplicationError(
        `Unhandled promise rejection: ${event.reason}`,
        'UNHANDLED_PROMISE',
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM,
        { reason: event.reason }
      );
      
      errorLogger.logCritical(error);
      event.preventDefault(); // Prevent console error
    });

    // Handle global JavaScript errors
    window.addEventListener('error', (event) => {
      const error = new ApplicationError(
        `Global error: ${event.message}`,
        'GLOBAL_ERROR',
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
      
      errorLogger.logCritical(error);
    });
  }
}

// Export error types for use throughout the application
export {
  ApplicationError as AppError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  PaymentError,
};