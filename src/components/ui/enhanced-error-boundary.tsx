import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

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

class EnhancedErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      isRetrying: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      isRetrying: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Enhanced ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Log to external service if needed
    this.logErrorToService(error, errorInfo);
    
    this.setState({ errorInfo });
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Log error details for monitoring
    const errorData = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      context: this.props.context || 'Unknown',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Error logged:', errorData);
    
    // Could send to monitoring service here
    // Example: analytics.track('error_boundary_triggered', errorData);
  };

  private handleReset = () => {
    this.retryCount++;
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      isRetrying: true
    });
    
    // Reset retry flag after a short delay
    setTimeout(() => {
      this.setState({ isRetrying: false });
    }, 500);
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private getErrorCategory = (error: Error): string => {
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return 'chunk_load';
    }
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'network';
    }
    if (error.message.includes('Cannot read') || error.message.includes('undefined')) {
      return 'null_reference';
    }
    if (error.name === 'TypeError') {
      return 'type_error';
    }
    return 'unknown';
  };

  private getErrorSuggestion = (error: Error): string => {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'chunk_load':
        return 'This appears to be a loading issue. Try refreshing the page.';
      case 'network':
        return 'This seems to be a network connectivity issue. Check your internet connection.';
      case 'null_reference':
        return 'This appears to be a data loading issue. Try refreshing the page.';
      case 'type_error':
        return 'This is a technical issue. Our team has been notified.';
      default:
        return 'An unexpected error occurred. Try refreshing the page or contact support if it persists.';
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showRetry = this.retryCount < this.maxRetries;
      const errorCategory = this.state.error ? this.getErrorCategory(this.state.error) : 'unknown';
      const suggestion = this.state.error ? this.getErrorSuggestion(this.state.error) : '';

      return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-4xl mx-auto my-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-4">
                <div>
                  <strong className="text-lg">
                    {errorCategory === 'chunk_load' ? 'Loading Error' :
                     errorCategory === 'network' ? 'Connection Error' :
                     'Something went wrong'}
                  </strong>
                  {this.state.error && (
                    <p className="text-sm mt-2 opacity-90">
                      {suggestion}
                    </p>
                  )}
                  {this.props.context && (
                    <p className="text-xs mt-1 opacity-75">
                      Context: {this.props.context}
                    </p>
                  )}
                </div>

                {this.props.showErrorDetails && this.state.error && (
                  <details className="text-xs bg-red-100 p-2 rounded border">
                    <summary className="cursor-pointer font-medium mb-2">
                      <Bug className="inline h-3 w-3 mr-1" />
                      Technical Details
                    </summary>
                    <div className="space-y-1">
                      <div><strong>Error:</strong> {this.state.error.message}</div>
                      {this.state.error.stack && (
                        <div>
                          <strong>Stack:</strong>
                          <pre className="text-xs mt-1 bg-white p-2 rounded overflow-auto max-h-32">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex flex-wrap gap-2">
                  {showRetry && (
                    <Button
                      onClick={this.handleReset}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                      disabled={this.state.isRetrying}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
                      {this.state.isRetrying ? 'Retrying...' : 'Try Again'}
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
                </div>

                {this.retryCount >= this.maxRetries && (
                  <p className="text-xs opacity-75 mt-2">
                    Multiple retry attempts failed. Please refresh the page or contact support if the issue persists.
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;