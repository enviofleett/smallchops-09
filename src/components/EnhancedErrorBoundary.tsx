import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  context?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  errorId: string;
}

class EnhancedErrorBoundary extends Component<Props, State> {
  private maxRetries = this.props.maxRetries || 3;
  
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0,
      errorId: ''
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging with more context
    const errorDetails = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      context: this.props.context,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount,
    };

    console.group(`🚨 Error Boundary: ${this.props.context || 'Unknown Context'}`);
    console.error('Error Details:', errorDetails);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Stack:', error.stack);
    console.groupEnd();

    // Update state with error info
    this.setState({ errorInfo });

    // Call onError prop if provided
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (import.meta.env.PROD) {
      this.logErrorToService(errorDetails);
    }
  }

  private logErrorToService = async (errorDetails: any) => {
    try {
      // In production, you could send this to an error tracking service
      // For now, just log to console with structured format
      console.error('Production Error Log:', JSON.stringify(errorDetails, null, 2));
      
      // You could integrate with services like Sentry, LogRocket, etc.
      // Example: Sentry.captureException(this.state.error, { extra: errorDetails });
    } catch (logError) {
      console.error('Failed to log error to service:', logError);
    }
  };

  private handleReset = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    if (newRetryCount <= this.maxRetries) {
      console.log(`🔄 Retrying... (${newRetryCount}/${this.maxRetries})`);
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        retryCount: newRetryCount,
        errorId: ''
      });
    } else {
      console.error(`❌ Max retries (${this.maxRetries}) exceeded`);
      // Could show a different message or redirect
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network Error';
    } else if (message.includes('chunk') || message.includes('loading')) {
      return 'Loading Error';
    } else if (message.includes('permission') || message.includes('unauthorized')) {
      return 'Permission Error';
    } else if (message.includes('syntax') || message.includes('unexpected')) {
      return 'Code Error';
    } else {
      return 'Application Error';
    }
  };

  private getErrorSuggestion = (error: Error): string => {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'Network Error':
        return 'Check your internet connection and try again.';
      case 'Loading Error':
        return 'Try refreshing the page or clearing your browser cache.';
      case 'Permission Error':
        return 'You may need to log in again or contact support.';
      case 'Code Error':
        return 'This appears to be a technical issue. Please contact support.';
      default:
        return 'Try refreshing the page or contact support if the issue persists.';
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const errorCategory = this.state.error ? this.getErrorCategory(this.state.error) : 'Unknown Error';
      const suggestion = this.state.error ? this.getErrorSuggestion(this.state.error) : 'Please try again.';

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="bg-card border border-border rounded-xl p-8 w-full max-w-lg shadow-lg">
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive-foreground">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">Something went wrong</h3>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {errorCategory}: {suggestion}
                    </p>
                    {this.props.context && (
                      <p className="text-xs mt-2 text-muted-foreground font-mono">
                        Context: {this.props.context}
                      </p>
                    )}
                    {this.state.errorId && (
                      <p className="text-xs mt-1 text-muted-foreground font-mono">
                        Error ID: {this.state.errorId}
                      </p>
                    )}
                  </div>

                  {this.props.showErrorDetails && this.state.error && (
                    <details className="mt-4">
                      <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                        Technical Details
                      </summary>
                      <div className="mt-2 p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap">
                        {this.state.error.message}
                        {this.state.error.stack && (
                          <div className="mt-2 text-muted-foreground">
                            {this.state.error.stack}
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    {canRetry ? (
                      <Button
                        onClick={this.handleReset}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Try Again ({this.state.retryCount}/{this.maxRetries})
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Maximum retries exceeded
                      </span>
                    )}
                    
                    <Button
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh Page
                    </Button>
                    
                    <Button
                      onClick={this.handleGoHome}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Home className="h-3 w-3" />
                      Go Home
                    </Button>

                    {import.meta.env.DEV && (
                      <Button
                        onClick={() => console.error('Debug Error:', this.state)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Bug className="h-3 w-3" />
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

export default EnhancedErrorBoundary;