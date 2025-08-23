/**
 * Production-Ready Error Boundary Component
 * Provides fallback UI for JavaScript errors and integrates with error logging
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ApplicationError, ErrorSeverity, ErrorCategory, createErrorBoundaryHandler } from '@/lib/error-handling';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;
  private errorHandler: (error: Error, errorInfo: ErrorInfo) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
    };

    // Create error handler for this boundary
    this.errorHandler = createErrorBoundaryHandler(props.name || 'ErrorBoundary');
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using our error handling system
    this.errorHandler(error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: undefined,
      });
    }
  };

  handleGoHome = () => {
    // Reset error state and navigate to home
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined,
    });
    
    // Navigate to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;
    
    if (!error) return;

    // Create detailed error report
    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      level: this.props.level || 'component',
      boundaryName: this.props.name,
    };

    // In a real application, you would send this to your error reporting service
    console.log('Error Report:', errorReport);
    
    // Copy error details to clipboard for user
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
      alert('Error details copied to clipboard');
    }
  };

  renderFallbackUI() {
    const { level = 'component', name } = this.props;
    const { error, errorId } = this.state;
    const canRetry = this.retryCount < this.maxRetries;

    // Different UI based on error level
    if (level === 'critical') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="space-y-2">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
              <p className="text-gray-600">
                We're sorry, but a critical error has occurred. Our team has been notified.
              </p>
            </div>
            
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error ID: {errorId}</AlertTitle>
              <AlertDescription>
                {error?.message || 'An unexpected error occurred'}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button 
                onClick={this.handleGoHome} 
                className="w-full"
                variant="default"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Home Page
              </Button>
              
              <Button 
                onClick={this.handleReportError} 
                variant="outline" 
                className="w-full"
              >
                Report This Error
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (level === 'page') {
      return (
        <div className="min-h-[400px] flex items-center justify-center px-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">Page Error</h2>
            <p className="text-gray-600">
              This page encountered an error. You can try refreshing or go back to the previous page.
            </p>
            
            <div className="space-y-2">
              {canRetry && (
                <Button onClick={this.handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </Button>
              )}
              
              <Button onClick={this.handleGoHome} variant="outline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Component level error
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-medium text-red-800">
              {name ? `${name} Error` : 'Component Error'}
            </h4>
            <p className="text-sm text-red-700">
              {error?.message || 'This component encountered an error'}
            </p>
            
            {canRetry && (
              <Button size="sm" onClick={this.handleRetry} variant="outline">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return this.renderFallbackUI();
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for reporting errors in functional components
export function useErrorHandler() {
  return React.useCallback((error: Error, context?: string) => {
    const boundaryError = new ApplicationError(
      error.message,
      'COMPONENT_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.SYSTEM,
      { context, originalError: error }
    );
    
    throw boundaryError;
  }, []);
}

// Specialized error boundaries for different scenarios
export const PaymentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="PaymentFlow"
    level="page"
    onError={(error, errorInfo) => {
      console.error('Payment flow error:', { error, errorInfo });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const AdminErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="AdminPanel"
    level="page"
    onError={(error, errorInfo) => {
      console.error('Admin panel error:', { error, errorInfo });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const ChartErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="Chart"
    level="component"
    fallback={
      <div className="h-32 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-gray-500 text-sm">Chart unavailable</p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);