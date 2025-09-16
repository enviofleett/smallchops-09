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

    // Log critical errors for monitoring
    console.error('🚨 Production Error Boundary Caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString()
    });

    // Report to monitoring service in production
    if (import.meta.env.PROD) {
      // Add monitoring integration here if needed
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
        <div className="p-4 space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A critical error occurred in the admin dashboard. 
              {this.state.retryCount < this.maxRetries ? (
                ' Please try again or refresh the page.'
              ) : (
                ' Multiple retry attempts failed. The page will reload automatically.'
              )}
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
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
            <details className="mt-4 p-4 bg-muted rounded border text-sm">
              <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
              {this.state.errorInfo && (
                <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}