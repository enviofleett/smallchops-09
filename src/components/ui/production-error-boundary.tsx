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

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-xl p-6 w-full max-w-2xl">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">Something went wrong</h3>
                    <p className="text-sm mt-1 opacity-90">
                      This is a technical issue. Our team has been notified.
                    </p>
                    {this.props.context && (
                      <p className="text-xs mt-1 opacity-75">
                        Context: {this.props.context}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {this.state.retryCount < 3 ? (
                      <Button 
                        onClick={this.handleRetry}
                        variant="outline" 
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
                      variant="default" 
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      Go Home
                    </Button>
                  </div>
                  
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium mb-2">
                        Developer Details
                      </summary>
                      <div className="bg-red-100 p-3 rounded text-xs font-mono whitespace-pre-wrap">
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