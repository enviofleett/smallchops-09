import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  context?: string;
  showRetry?: boolean;
  showHome?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
  retryCount: number;
}

export class ProductionReadyErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`ErrorBoundary [${this.props.context || 'Unknown'}]:`, error, errorInfo);
    
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Report to monitoring service in production
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    // Clean up any pending timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  private reportError = (error: Error, errorInfo: any) => {
    try {
      // In a real app, send to your error reporting service
      const errorReport = {
        message: error.message,
        stack: error.stack,
        context: this.props.context,
        errorInfo,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      // For now, just log to console in production
      console.error('Production Error Report:', errorReport);
      
      // You could send this to Sentry, LogRocket, etc.
      // Example: Sentry.captureException(error, { extra: errorReport });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount >= 3) {
      // After 3 retries, suggest page reload
      window.location.reload();
      return;
    }

    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1
    }));

    // Add a small delay before retry to prevent immediate re-error
    const timeout = setTimeout(() => {
      // Force a re-render after state reset
      this.forceUpdate();
    }, 100);

    this.retryTimeouts.push(timeout);
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, retryCount } = this.state;
      const { context, showRetry = true, showHome = true } = this.props;

      return (
        <Card className="p-8 text-center border-destructive/20 bg-destructive/5">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          
          <h3 className="text-lg font-semibold mb-2 text-destructive">
            {context ? `${context} Error` : 'Something went wrong'}
          </h3>
          
          <p className="text-muted-foreground mb-4">
            {error?.message || 'An unexpected error occurred while loading this section.'}
          </p>

          {retryCount > 0 && retryCount < 3 && (
            <p className="text-sm text-muted-foreground mb-4">
              Retry attempt {retryCount} of 3
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {showRetry && retryCount < 3 && (
              <Button 
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}
            
            {retryCount >= 3 && (
              <Button 
                onClick={this.handleReload}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
            )}

            {showHome && (
              <Button 
                onClick={this.handleGoHome}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            )}
          </div>

          {import.meta.env.DEV && error && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-32">
                {error.stack}
              </pre>
            </details>
          )}
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ProductionReadyErrorBoundary;