import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

/**
 * ENHANCED Order-specific Error Boundary
 * Provides graceful degradation for order management components
 */
class OrderErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorInfo: null,
      retryCount: 0
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Order component error in ${this.props.context}:`, error, errorInfo);
    
    // Log to monitoring
    logger.error(`Order ErrorBoundary: ${this.props.context}`, error);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
    
    // Log order-specific error details
    this.logOrderError(error, errorInfo);
  }

  private logOrderError = (error: Error, errorInfo: ErrorInfo) => {
    const orderErrorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context || 'unknown-order-component',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      category: this.getErrorCategory(error)
    };
    
    console.error('🚨 Order Component Error:', orderErrorReport);
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // This would send to your monitoring service (Sentry, LogRocket, etc.)
      console.error('Production Order Error:', orderErrorReport);
    }
  };

  private getErrorCategory(error: Error): string {
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'network';
    }
    if (error.message.includes('auth') || error.message.includes('token')) {
      return 'authentication';
    }
    if (error.message.includes('order') || error.message.includes('schedule')) {
      return 'order_data';
    }
    if (error.message.includes('ChunkLoadError')) {
      return 'chunk_load';
    }
    return 'runtime';
  }

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
      
      // Call custom retry handler if provided
      this.props.onRetry?.();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  private getErrorMessage(error: Error): string {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'network':
        return 'Unable to load order data. Please check your internet connection and try again.';
      case 'authentication':
        return 'Authentication issue. Please refresh the page or log in again.';
      case 'order_data':
        return 'There was an issue loading order information. This might be temporary.';
      case 'chunk_load':
        return 'The page needs to be refreshed after an update. Please refresh to continue.';
      default:
        return 'An unexpected error occurred while loading order data.';
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const errorMessage = this.state.error ? this.getErrorMessage(this.state.error) : 'An error occurred';
      const category = this.state.error ? this.getErrorCategory(this.state.error) : 'unknown';

      return (
        <div className="min-h-[200px] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-red-900">
                {this.props.context ? `${this.props.context} Error` : 'Order Component Error'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-gray-600">
                <p className="mb-2">{errorMessage}</p>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-3 text-left">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                      Debug Information
                    </summary>
                    <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
                      <p><strong>Error:</strong> {this.state.error.message}</p>
                      <p><strong>Category:</strong> {category}</p>
                      <p><strong>Component:</strong> {this.props.context}</p>
                    </div>
                  </details>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                {canRetry && (
                  <Button
                    onClick={this.handleRetry}
                    variant="default"
                    size="sm"
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again ({this.maxRetries - this.state.retryCount} remaining)
                  </Button>
                )}
                
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default OrderErrorBoundary;