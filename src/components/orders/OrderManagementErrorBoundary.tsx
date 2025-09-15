import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface OrderManagementErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

export class OrderManagementErrorBoundary extends React.Component<
  OrderManagementErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: OrderManagementErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Order Management Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Order Management Error</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <p>Something went wrong while loading the order management system.</p>
                {this.state.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Error Details
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <Button
                  onClick={this.retry}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useOrderErrorHandler = () => {
  const handleError = React.useCallback((error: Error, context?: string) => {
    console.error(`Order Management Error${context ? ` in ${context}` : ''}:`, error);
    
    // You could integrate with error reporting service here
    // Example: errorReportingService.captureException(error, { context });
    
    return {
      message: getUserFriendlyErrorMessage(error),
      isRetryable: isRetryableError(error),
    };
  }, []);

  return { handleError };
};

// Helper functions for error categorization
const getUserFriendlyErrorMessage = (error: Error): string => {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network connection issue. Please check your internet and try again.';
  }
  
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  if (message.includes('authentication') || message.includes('unauthorized')) {
    return 'Session expired. Please refresh the page and log in again.';
  }
  
  if (message.includes('not found')) {
    return 'The requested order could not be found.';
  }
  
  if (message.includes('duplicate') || message.includes('being processed')) {
    return 'Order is currently being processed. Please refresh and try again.';
  }
  
  if (message.includes('invalid status') || message.includes('enum')) {
    return 'Invalid order status. Please refresh the page and try again.';
  }
  
  return error.message || 'An unexpected error occurred. Please try again.';
};

const isRetryableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  
  // Non-retryable errors
  if (message.includes('not found') || 
      message.includes('invalid') ||
      message.includes('forbidden') ||
      message.includes('unauthorized')) {
    return false;
  }
  
  // Retryable errors
  if (message.includes('network') ||
      message.includes('timeout') ||
      message.includes('server error') ||
      message.includes('temporarily unavailable') ||
      message.includes('duplicate')) {
    return true;
  }
  
  return true; // Default to retryable for unknown errors
};