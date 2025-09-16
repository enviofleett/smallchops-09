import React, { Component, ErrorInfo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount: number;
}

/**
 * Production-ready error boundary for admin functions
 * Prevents cascade failures and provides graceful degradation
 */
export class ProductionErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (import.meta.env.PROD) {
      // Production logging - minimal console output
      console.error(`Error ${errorId}:`, error.message);
      
      // Report to monitoring service
      try {
        // Send error to monitoring service (e.g., Sentry, LogRocket)
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errorId,
            message: error.message,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            retryCount: this.state.retryCount
          })
        }).catch(() => {
          // Silently fail if logging service is down
        });
      } catch (e) {
        // Silently handle logging errors
      }
    } else {
      // Development logging - full details
      console.error('🚨 Error Boundary Caught:', {
        errorId,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
        timestamp: new Date().toISOString()
      });
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Force page reload after max retries
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      
      if (FallbackComponent) {
        return (
          <FallbackComponent 
            error={this.state.error}
            resetError={this.handleRetry}
            retryCount={this.state.retryCount}
          />
        );
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Something went wrong
              </h3>
              <p className="text-muted-foreground">
                {import.meta.env.PROD 
                  ? 'We encountered an unexpected error. Please try refreshing the page.'
                  : `Error: ${this.state.error.message}`
                }
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= this.maxRetries}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {this.state.retryCount >= this.maxRetries ? 'Reloading...' : 'Try Again'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>

            {import.meta.env.DEV && (
              <details className="mt-6 p-4 bg-muted rounded-lg border text-left text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  Debug Information (Development Only)
                </summary>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-destructive mb-1">Error Message:</h4>
                    <p className="text-xs bg-background p-2 rounded border">
                      {this.state.error.message}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-destructive mb-1">Stack Trace:</h4>
                    <pre className="text-xs bg-background p-2 rounded border whitespace-pre-wrap overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <h4 className="font-medium text-destructive mb-1">Component Stack:</h4>
                      <pre className="text-xs bg-background p-2 rounded border whitespace-pre-wrap overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Retry Count: {this.state.retryCount} / {this.maxRetries}
                  </p>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}