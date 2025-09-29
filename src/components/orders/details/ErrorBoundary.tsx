import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { errorReporting } from '@/lib/errorReporting';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  retryCount: number;
}

/**
 * Error boundary for Order Details Modal sections
 * Provides graceful error handling with retry functionality
 */
export class OrderDetailsSectionErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: null,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorReport = errorReporting.createErrorReport(
      error,
      this.props.context || 'OrderDetailsSection',
      errorInfo.componentStack,
      this.state.retryCount
    );

    this.setState({ errorId: errorReport.errorId });
    errorReporting.reportError(errorReport);
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: null,
        retryCount: prevState.retryCount + 1
      }));
      
      this.props.onRetry?.();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const errorCategory = this.state.error ? 
        errorReporting.categorizeError(this.state.error) : 'unknown';
      const userFriendlyMessage = this.state.error ?
        errorReporting.getUserFriendlyMessage(errorCategory, this.state.error) :
        'Something went wrong loading this section.';

      return (
        <Alert className="border-destructive/50 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <p className="font-medium">Unable to load section</p>
              <p className="text-sm text-muted-foreground mt-1">
                {userFriendlyMessage}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {canRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleRetry}
                    className="h-8"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry {this.state.retryCount > 0 && `(${this.state.retryCount}/${this.maxRetries})`}
                  </Button>
                )}
              </div>

              {this.state.errorId && (
                <span className="text-xs font-mono text-muted-foreground">
                  ID: {this.state.errorId.split('_')[2]}
                </span>
              )}
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs">Debug Details</summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}