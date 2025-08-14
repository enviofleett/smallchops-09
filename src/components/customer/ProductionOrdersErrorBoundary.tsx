import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  customerEmail?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

class ProductionOrdersErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('❌ Orders Error Boundary caught error:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      customerEmail: this.props.customerEmail,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    });

    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    if (this.state.retryCount >= 3) {
      // After 3 retries, refresh the page
      window.location.reload();
      return;
    }

    console.log(`🔄 Retrying orders load (attempt ${this.state.retryCount + 1})`);
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  handleRefreshPage = () => {
    console.log('🔄 Refreshing page due to orders error');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'Unknown error occurred';
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
      const isAuthError = errorMessage.includes('authentication') || errorMessage.includes('permission');
      const isDataError = errorMessage.includes('Unable to load orders');

      let userMessage = 'Something went wrong while loading your orders.';
      let suggestion = 'Please try again or refresh the page.';

      if (isNetworkError) {
        userMessage = 'Connection issue detected.';
        suggestion = 'Please check your internet connection and try again.';
      } else if (isAuthError) {
        userMessage = 'Authentication issue detected.';
        suggestion = 'Please refresh the page to re-authenticate.';
      } else if (isDataError) {
        userMessage = 'Unable to load your order history.';
        suggestion = 'This may be a temporary issue. Please try again.';
      }

      return (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Orders Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-foreground font-medium">{userMessage}</p>
              <p className="text-muted-foreground text-sm mt-1">{suggestion}</p>
            </div>

            {this.props.customerEmail && (
              <div className="bg-muted p-3 rounded text-sm">
                <p><span className="font-medium">Customer:</span> {this.props.customerEmail}</p>
                <p><span className="font-medium">Time:</span> {new Date().toLocaleString()}</p>
                <p><span className="font-medium">Attempts:</span> {this.state.retryCount}/3</p>
              </div>
            )}

            {/* Show technical details for debugging in production */}
            {errorMessage && (
              <details className="bg-muted p-3 rounded text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  Technical Details (for support)
                </summary>
                <div className="mt-2 space-y-1">
                  <p><span className="font-medium">Error:</span> {errorMessage}</p>
                  {this.state.error?.stack && (
                    <p className="text-xs font-mono bg-background p-2 rounded overflow-auto">
                      {this.state.error.stack}
                    </p>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <Button 
                onClick={this.handleRetry}
                variant="default"
                className="flex items-center"
                disabled={this.state.retryCount >= 3}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {this.state.retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
              </Button>
              
              <Button 
                onClick={this.handleRefreshPage}
                variant="outline"
                className="flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>

              <Button 
                onClick={() => window.location.href = '/'}
                variant="ghost"
                className="flex items-center"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ProductionOrdersErrorBoundary;