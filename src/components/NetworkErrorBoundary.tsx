import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { classifyError, logError } from '@/utils/errorClassification';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  classifiedError?: any;
}

/**
 * Enhanced error boundary with network-aware error handling
 * Provides better error messages and recovery options
 */
class NetworkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const classifiedError = classifyError(error);
    return { 
      hasError: true, 
      error,
      classifiedError
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.componentName || 'Component';
    
    // Classify and log the error
    const classifiedError = classifyError(error);
    logError(classifiedError, {
      component: componentName,
      errorInfo,
      retryCount: this.state.retryCount
    });
    
    console.group(`🚨 ${componentName} Error Boundary`);
    console.error('Error:', error.message);
    console.error('Error Type:', classifiedError.type);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    this.setState({ 
      errorInfo,
      classifiedError
    });

    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      classifiedError: undefined,
      retryCount: prevState.retryCount + 1
    }));
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private getErrorIcon() {
    const { classifiedError } = this.state;
    if (!classifiedError) return <AlertTriangle className="h-12 w-12 text-destructive" />;

    switch (classifiedError.type) {
      case 'network':
        return <WifiOff className="h-12 w-12 text-red-500" />;
      case 'timeout':
        return <AlertTriangle className="h-12 w-12 text-amber-500" />;
      default:
        return <AlertTriangle className="h-12 w-12 text-destructive" />;
    }
  }

  private getErrorTitle() {
    const { classifiedError } = this.state;
    const componentName = this.props.componentName || 'Component';
    
    if (classifiedError) {
      return classifiedError.userMessage;
    }
    
    return `${componentName} Error`;
  }

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { classifiedError, error } = this.state;
      const isOnline = navigator.onLine;

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-md w-full">
            <Alert variant="destructive" className="text-center">
              <div className="flex flex-col items-center space-y-4">
                {this.getErrorIcon()}
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    {this.getErrorTitle()}
                  </h3>
                  
                  {!isOnline && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-red-600">
                      <WifiOff className="h-4 w-4" />
                      <span>You appear to be offline</span>
                    </div>
                  )}
                  
                  {classifiedError && classifiedError.suggestedActions && (
                    <div className="text-sm text-left">
                      <p className="font-medium mb-1">What you can do:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {classifiedError.suggestedActions.slice(0, 3).map((action: string, index: number) => (
                          <li key={index}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {classifiedError?.errorId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Error ID: {classifiedError.errorId}
                    </p>
                  )}
                </div>

                <div className="flex space-x-2">
                  {(!classifiedError || classifiedError.retryable) && (
                    <Button 
                      onClick={this.handleRetry}
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                  )}
                  
                  <Button 
                    onClick={this.handleGoHome}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Dashboard
                  </Button>
                </div>
                
                {process.env.NODE_ENV === 'development' && error && (
                  <details className="mt-4 text-left w-full">
                    <summary className="cursor-pointer text-sm font-medium mb-2 text-muted-foreground">
                      Developer Details
                    </summary>
                    <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap text-left">
                      <div className="mb-2">
                        <strong>Error:</strong> {error.message}
                      </div>
                      {error.stack && (
                        <div>
                          <strong>Stack:</strong>
                          <br />
                          {error.stack}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NetworkErrorBoundary;