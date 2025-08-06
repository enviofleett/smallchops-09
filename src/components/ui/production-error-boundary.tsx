import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  context?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class ProductionErrorBoundary extends Component<Props, State> {
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
    console.error(`Error in ${this.props.context || 'component'}:`, error);
    console.error('Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to Supabase for monitoring
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/log-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error.message,
            stack: error.stack,
            context: this.props.context,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
          })
        }).catch(e => console.warn('Failed to log error:', e));
      } catch (e) {
        console.warn('Error logging failed:', e);
      }
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1
      });
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRefreshPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isNetworkError = this.state.error?.message?.includes('fetch') || 
                            this.state.error?.message?.includes('network');
      const isChunkError = this.state.error?.message?.includes('ChunkLoadError') ||
                          this.state.error?.message?.includes('Loading chunk');
      const isDataError = this.state.error?.message?.includes('data') ||
                         this.state.error?.message?.includes('API');

      // Determine user-friendly error message and suggestion
      let userMessage = "Something went wrong";
      let suggestion = "Please try refreshing the page or contact support if the issue persists.";
      
      if (isNetworkError) {
        userMessage = "Connection Problem";
        suggestion = "Please check your internet connection and try again.";
      } else if (isChunkError) {
        userMessage = "Loading Issue";
        suggestion = "The page failed to load completely. Please refresh to try again.";
      } else if (isDataError) {
        userMessage = "Data Loading Issue";
        suggestion = "We're having trouble loading the data. Please try again in a moment.";
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-sm">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              
              <div>
                <h3 className="font-semibold text-lg text-foreground">{userMessage}</h3>
                <p className="text-sm mt-2 text-muted-foreground">{suggestion}</p>
                {this.props.context && (
                  <p className="text-xs mt-2 text-muted-foreground/75">
                    Component: {this.props.context}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {this.state.retryCount < 3 ? (
                  <Button 
                    onClick={this.handleRetry}
                    variant="default" 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                ) : null}
                
                <Button 
                  onClick={this.handleRefreshPage}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </Button>
                
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium mb-2 text-muted-foreground">
                    Developer Details
                  </summary>
                  <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap text-left">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <br />
                        {this.state.error.stack}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ProductionErrorBoundary;