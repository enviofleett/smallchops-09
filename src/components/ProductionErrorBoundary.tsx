import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  isRetrying: boolean;
}

class ProductionErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryCount = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isRetrying: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isRetrying: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error with context
    logger.error(`ErrorBoundary caught error in ${this.props.context || 'unknown component'}`, error, this.props.context);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Log to monitoring service in production
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In production, this would send to monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    logger.error('Production Error Report', errorReport);
    
    // Send to monitoring service (replace with actual service)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, LogRocket, etc.
      console.error('🚨 Production Error:', errorReport);
    }
  };

  private handleReset = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: undefined, errorInfo: undefined, isRetrying: true });
      
      // Reset retry flag after a brief moment
      setTimeout(() => {
        this.setState({ isRetrying: false });
      }, 100);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private getErrorCategory(error: Error): string {
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return 'chunk_load';
    }
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'network';
    }
    if (error.message.includes('timeout') || error.message.includes('Component load timeout')) {
      return 'timeout';
    }
    if (error.message.includes('Authorization') || error.message.includes('permission')) {
      return 'auth';
    }
    if (error.message.includes('Cannot read property') || error.message.includes('undefined')) {
      return 'runtime';
    }
    return 'unknown';
  };

  private getErrorSuggestion(error: Error): string {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'chunk_load':
        return 'This usually happens after an app update. Refreshing the page should fix it.';
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'timeout':
        return 'The page is taking longer than usual to load. Please wait a moment and try again.';
      case 'auth':
        return 'You may need to log in again or contact support for access.';
      case 'runtime':
        return 'A temporary issue occurred. Trying again usually resolves this.';
      default:
        return 'An unexpected error occurred. Our team has been notified.';
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.retryCount < this.maxRetries;
      const errorCategory = this.state.error ? this.getErrorCategory(this.state.error) : 'unknown';
      const suggestion = this.state.error ? this.getErrorSuggestion(this.state.error) : '';

      return (
        <div className="min-h-[200px] flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-xl p-6 w-full max-w-2xl">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">Something went wrong</h3>
                    <p className="text-sm mt-1 opacity-90">
                      {suggestion}
                    </p>
                    {this.props.showErrorDetails && this.state.error && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Technical Details
                        </summary>
                        <div className="mt-2 p-3 bg-red-100 rounded text-xs font-mono">
                          <p><strong>Error:</strong> {this.state.error.message}</p>
                          <p><strong>Category:</strong> {errorCategory}</p>
                          {this.props.context && (
                            <p><strong>Component:</strong> {this.props.context}</p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {canRetry && (
                      <Button
                        onClick={this.handleReset}
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-700 hover:bg-red-100"
                        disabled={this.state.isRetrying}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
                        Try Again ({this.maxRetries - this.retryCount} remaining)
                      </Button>
                    )}
                    
                    <Button
                      onClick={this.handleReload}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh Page
                    </Button>
                    
                    <Button
                      onClick={this.handleGoHome}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <Home className="h-3 w-3 mr-1" />
                      Go Home
                    </Button>
                    
                    {process.env.NODE_ENV === 'development' && (
                      <Button
                        onClick={() => console.error('Full Error Details:', this.state)}
                        variant="outline"
                        size="sm"
                        className="border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        <Bug className="h-3 w-3 mr-1" />
                        Debug
                      </Button>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ProductionErrorBoundary;