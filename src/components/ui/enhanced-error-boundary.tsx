import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  title?: string;
  description?: string;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
}

export class EnhancedErrorBoundary extends React.Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Enhanced Error Boundary caught an error:', error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error details for debugging
    console.group('🔍 Error Boundary Details');
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    console.log('🔄 Retrying after error...');
    
    this.setState(prevState => ({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1 
    }));
  };

  handleRetryWithDelay = () => {
    console.log('⏳ Retrying with delay...');
    
    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, 1000);
  };

  handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, retryCount } = this.state;
      const { title = "Something went wrong", description, showDetails = false } = this.props;

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-xl">{title}</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {description || "We encountered an unexpected error. This has been logged and will be investigated."}
                </p>
                
                {retryCount > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Retry attempts: {retryCount}
                  </p>
                )}
              </div>

              {/* Error Details (Developer Mode) */}
              {showDetails && error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <details>
                      <summary className="cursor-pointer font-medium">
                        Technical Details (Click to expand)
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <strong>Error:</strong> {error.message}
                        </div>
                        {error.stack && (
                          <div>
                            <strong>Stack Trace:</strong>
                            <pre className="text-xs mt-1 overflow-auto max-h-32 bg-muted p-2 rounded">
                              {error.stack}
                            </pre>
                          </div>
                        )}
                        {errorInfo?.componentStack && (
                          <div>
                            <strong>Component Stack:</strong>
                            <pre className="text-xs mt-1 overflow-auto max-h-32 bg-muted p-2 rounded">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button 
                    onClick={this.handleRetry}
                    className="flex-1"
                    disabled={retryCount >= 3}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
                  </Button>
                  
                  {retryCount < 3 && (
                    <Button 
                      variant="outline" 
                      onClick={this.handleRetryWithDelay}
                      className="flex-1"
                    >
                      Retry in 1s
                    </Button>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={this.handleGoBack}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
                
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Refresh Page
                </Button>
              </div>

              {/* Helpful Tips */}
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                <strong>Troubleshooting tips:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Check your internet connection</li>
                  <li>Clear your browser cache and cookies</li>
                  <li>Try refreshing the page</li>
                  <li>Contact support if the problem persists</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const captureError = React.useCallback((error: Error) => {
    console.error('🚨 Error captured by useErrorBoundary:', error);
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
};