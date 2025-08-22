import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Wifi, WifiOff, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { classifyError, logError, type ClassifiedError } from '@/utils/errorClassification';

interface Props {
  children: ReactNode;
  context?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  classifiedError?: ClassifiedError;
  retryCount: number;
}

/**
 * Enhanced Unified Error Boundary with network-aware error classification
 * Uses the new error classification system for better user experience
 */
export class ErrorBoundaryWrapper extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const classifiedError = classifyError(error);
    return {
      hasError: true,
      error,
      classifiedError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { classifiedError } = this.state;
    
    // Use our enhanced logging system
    if (classifiedError) {
      logError(classifiedError, {
        component: 'ErrorBoundaryWrapper',
        context: this.props.context,
        errorInfo,
        retryCount: this.state.retryCount,
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }

    console.group(`🚨 Error Boundary: ${this.props.context || 'Unknown Context'}`);
    console.error('Error:', error.message);
    console.error('Error Type:', classifiedError?.type);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (import.meta.env.PROD && classifiedError) {
      this.logErrorToService(classifiedError, errorInfo).catch(console.error);
    }
  }

  private logErrorToService = async (classifiedError: ClassifiedError, errorInfo: React.ErrorInfo) => {
    try {
      const errorPayload = {
        errorId: classifiedError.errorId,
        type: classifiedError.type,
        category: classifiedError.category,
        severity: classifiedError.severity,
        technicalMessage: classifiedError.technicalMessage,
        userMessage: classifiedError.userMessage,
        context: this.props.context,
        errorInfo,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      // Send to monitoring service (Sentry, LogRocket, etc.)
      console.log('Production Error Log:', JSON.stringify(errorPayload, null, 2));
    } catch (logError) {
      console.error('Failed to log error to service:', logError);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        classifiedError: undefined,
        retryCount: this.state.retryCount + 1
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private getErrorIcon = () => {
    const { classifiedError } = this.state;
    if (!classifiedError) return <AlertTriangle className="h-6 w-6 text-destructive" />;

    switch (classifiedError.type) {
      case 'network':
        return <WifiOff className="h-6 w-6 text-red-500" />;
      case 'timeout':
        return <Clock className="h-6 w-6 text-amber-500" />;
      case 'auth':
      case 'permission':
        return <Shield className="h-6 w-6 text-orange-500" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-destructive" />;
    }
  };

  private getErrorTitle = () => {
    const { classifiedError } = this.state;
    const context = this.props.context || 'Component';
    
    if (classifiedError) {
      return `${context} - ${classifiedError.userMessage}`;
    }
    
    return `${context} Error`;
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { classifiedError, error } = this.state;
      const canRetry = this.state.retryCount < this.maxRetries && 
                      (classifiedError?.retryable ?? true);
      const isOnline = navigator.onLine;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                {this.getErrorIcon()}
                <h3 className="text-lg font-semibold">
                  {this.getErrorTitle()}
                </h3>
              </div>
              
              {/* Network status indicator */}
              {!isOnline && (
                <Alert variant="destructive" className="mb-4">
                  <WifiOff className="h-4 w-4" />
                  <AlertDescription>
                    You appear to be offline. Please check your internet connection.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Enhanced error messaging */}
              {classifiedError && (
                <Alert className="mb-4">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>{classifiedError.userMessage}</p>
                      {classifiedError.suggestedActions && classifiedError.suggestedActions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">What you can do:</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {classifiedError.suggestedActions.slice(0, 3).map((action, index) => (
                              <li key={index}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {classifiedError?.errorId && (
                <p className="text-xs text-muted-foreground mb-4 font-mono">
                  Error ID: {classifiedError.errorId}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                {canRetry && (
                  <Button 
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again ({this.maxRetries - this.state.retryCount} left)
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={this.handleRefresh}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Page
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>

              {this.props.showErrorDetails && error && (
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">
                    Technical Details
                  </summary>
                  <div className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    <div className="space-y-2">
                      <div>
                        <strong>Error:</strong> {error.message}
                      </div>
                      {classifiedError && (
                        <div>
                          <strong>Type:</strong> {classifiedError.type} ({classifiedError.category})
                          <br />
                          <strong>Severity:</strong> {classifiedError.severity}
                        </div>
                      )}
                      {error.stack && (
                        <div>
                          <strong>Stack Trace:</strong>
                          <pre className="whitespace-pre-wrap text-xs mt-1">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryWrapper;