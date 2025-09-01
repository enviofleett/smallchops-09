import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  context?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId: string;
  retryCount: number;
}

/**
 * Unified Error Boundary - Replace all other error boundaries with this one
 */
export class ErrorBoundaryWrapper extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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
      url: window.location.href
    };

    console.group(`🚨 Error Boundary: ${this.props.context || 'Unknown Context'}`);
    console.error('Error Details:', errorDetails);
    console.groupEnd();

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (import.meta.env.PROD) {
      this.logErrorToService(errorDetails).catch(console.error);
    }
  }

  private logErrorToService = async (errorDetails: any) => {
    try {
      // Send to monitoring service (Sentry, LogRocket, etc.)
      console.log('Production Error Log:', JSON.stringify(errorDetails, null, 2));
    } catch (logError) {
      console.error('Failed to log error to service:', logError);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: '',
        retryCount: this.state.retryCount + 1
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network Error';
    } else if (message.includes('chunk') || message.includes('loading')) {
      return 'Loading Error';
    } else if (message.includes('permission') || message.includes('unauthorized')) {
      return 'Permission Error';
    } else if (message.includes('syntax') || message.includes('reference')) {
      return 'Code Error';
    } else {
      return 'Application Error';
    }
  };

  private getErrorSuggestion = (error: Error): string => {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'Network Error':
        return 'Please check your internet connection and try again.';
      case 'Loading Error':
        return 'There was a problem loading this page. Please refresh or try again.';
      case 'Permission Error':
        return 'You may not have permission to access this content. Please log in again.';
      case 'Code Error':
        return 'A technical error occurred. Our team has been notified.';
      default:
        return 'Something went wrong. Please try again or contact support if the problem persists.';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorCategory = this.state.error ? this.getErrorCategory(this.state.error) : 'Unknown Error';
      const suggestion = this.state.error ? this.getErrorSuggestion(this.state.error) : 'Please try again.';
      const canRetry = this.state.retryCount < this.maxRetries;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4 sm:p-6">
          <Card className="w-full max-w-lg shadow-lg border-border/50">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <h3 className="text-lg font-semibold">
                  {errorCategory}
                </h3>
              </div>
              
              <Alert className="mb-4">
                <AlertDescription>
                  {suggestion}
                </AlertDescription>
              </Alert>

              {this.state.errorId && (
                <p className="text-xs text-muted-foreground mb-4">
                  Error ID: {this.state.errorId}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                {canRetry && (
                  <Button 
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again ({this.maxRetries - this.state.retryCount} left)
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={this.handleRefresh}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Page
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>

              {this.props.showErrorDetails && this.state.error && (
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {this.state.error.message}
                    {this.state.error.stack && (
                      <>
                        {'\n\nStack Trace:\n'}
                        {this.state.error.stack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryWrapper;