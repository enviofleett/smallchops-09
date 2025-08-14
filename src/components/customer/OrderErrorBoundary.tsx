import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  customerEmail?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class OrderErrorBoundary extends Component<Props, State> {
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
    console.error('🚨 Order section error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      customerEmail: this.props.customerEmail,
      timestamp: new Date().toISOString()
    });
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    console.log('🔄 Retrying order component load, attempt:', this.state.retryCount + 1);
    
    if (this.state.retryCount < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1
      });
    } else {
      // After 3 retries, reload the page
      window.location.reload();
    }
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
      const isAuthError = this.state.error?.message?.includes('Authentication') ||
                         this.state.error?.message?.includes('permission') ||
                         this.state.error?.message?.includes('policy');
      const isDataError = this.state.error?.message?.includes('orders') ||
                         this.state.error?.message?.includes('Unable to load');

      // Determine user-friendly error message and suggestion
      let userMessage = "Unable to load orders";
      let suggestion = "We're having trouble loading your orders. Please try again.";
      let showDetails = false;
      
      if (isNetworkError) {
        userMessage = "Connection Problem";
        suggestion = "Please check your internet connection and try again.";
      } else if (isAuthError) {
        userMessage = "Authentication Issue";
        suggestion = "Please refresh the page to re-authenticate and try again.";
        showDetails = true;
      } else if (isDataError) {
        userMessage = "Data Loading Issue";
        suggestion = "We're having trouble loading your order data. This may be temporary.";
        showDetails = true;
      }

      return (
        <Card className="p-8 text-center border-red-100">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            
            <div>
              <h3 className="font-semibold text-lg text-red-900">{userMessage}</h3>
              <p className="text-sm mt-2 text-red-700">{suggestion}</p>
              {this.props.customerEmail && (
                <p className="text-xs mt-2 text-red-600">
                  Customer: {this.props.customerEmail}
                </p>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {this.state.retryCount < 3 && (
                <Button 
                  onClick={this.handleRetry}
                  variant="default" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again ({3 - this.state.retryCount} left)
                </Button>
              )}
              
              <Button 
                onClick={this.handleRefreshPage}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </Button>
            </div>
            
            {/* Show error details in production for specific error types */}
            {showDetails && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm font-medium mb-2 text-red-700">
                  Technical Details
                </summary>
                <div className="bg-red-50 p-3 rounded text-xs font-mono whitespace-pre-wrap text-left border border-red-200">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Time:</strong> {new Date().toLocaleString()}
                  </div>
                  {this.props.customerEmail && (
                    <div>
                      <strong>Customer:</strong> {this.props.customerEmail}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default OrderErrorBoundary;