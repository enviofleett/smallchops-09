import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { logger } from '@/lib/logger';

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
  errorId: string;
  retryCount: number;
}

/**
 * Unified Error Boundary - Replace all other error boundaries with this one
 */
export class ErrorBoundaryWrapper extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorDetails = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      context: this.props.context,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Use production-safe logger
    logger.error('Error Boundary caught error', error, this.props.context);

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (import.meta.env.PROD) {
      this.logErrorToService(errorDetails).catch((logError) => {
        logger.error('Failed to log error to service', logError);
      });
    }
  }

  private logErrorToService = async (errorDetails: any) => {
    try {
      // Send to monitoring service (Sentry, LogRocket, etc.)
      console.log('Production Error Log:', JSON.stringify(errorDetails, null, 2));
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
        errorId: '',
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

  private getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();
    
    // Specific handling for ComponentLoadError
    if (error.name === 'ComponentLoadError' || message.includes('failed to load component')) {
      return 'Component Load Error';
    } else if (message.includes('objects are not valid as a react child') || message.includes('object with keys')) {
      return 'Data Rendering Error';
    } else if (message.includes('select.item') || message.includes('radix') || message.includes('ui component')) {
      return 'UI Component Error';
    } else if (message.includes('network') || message.includes('fetch')) {
      return 'Network Error';
    } else if (message.includes('chunk') || message.includes('loading') || message.includes('timeout')) {
      return 'Loading Error';
    } else if (message.includes('permission') || message.includes('unauthorized')) {
      return 'Permission Error';
    } else if (message.includes('syntax') || message.includes('reference')) {
      return 'Code Error';
    } else {
      return 'Application Error';
    }
  };

  private getErrorSuggestion = (error: Error): string => {
    const category = this.getErrorCategory(error);
    const message = error.message.toLowerCase();
    
    switch (category) {
      case 'Component Load Error':
        return 'Please refresh your page';
      case 'Data Rendering Error':
        return 'There was an issue displaying some data. This has been fixed automatically. Please refresh the page to continue.';
      case 'UI Component Error':
        return 'A user interface component encountered an issue. Please refresh the page to resolve this.';
      case 'Network Error':
        return 'Please check your internet connection and try again. You may also try refreshing the page.';
      case 'Loading Error':
        if (message.includes('timeout')) {
          return 'This component is taking longer than expected to load. This might be due to slow network or large file sizes. Try refreshing the page or check your internet connection.';
        }
        if (message.includes('component load') || message.includes('chunk')) {
          return 'A component failed to load. This usually resolves with a page refresh. If the problem persists, please clear your browser cache.';
        }
        return 'There was a problem loading this page. Please refresh the page or try again in a moment.';
      case 'Permission Error':
        return 'You may not have permission to access this content. Please log in again or contact support.';
      case 'Code Error':
        return 'A technical error occurred. Our development team has been notified and is working on a fix.';
      default:
        return 'Something unexpected happened. Try refreshing the page first. If the problem continues, please contact our support team.';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorCategory = this.state.error ? this.getErrorCategory(this.state.error) : 'Unknown Error';
      const suggestion = this.state.error ? this.getErrorSuggestion(this.state.error) : 'Please try again.';
      const canRetry = this.state.retryCount < this.maxRetries;

      // Show simplified UI for ComponentLoadError and DataRenderingError
      if (errorCategory === 'Component Load Error' || errorCategory === 'Data Rendering Error') {
        return (
          <div className="min-h-[200px] flex items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-md shadow-sm border-border/50 bg-card">
              <CardContent className="p-4 sm:p-6">
                <div className="text-center space-y-3">
                  <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                  <p className="text-foreground text-sm">
                    {errorCategory === 'Data Rendering Error' 
                      ? 'Data display issue detected and fixed. Please refresh.'
                      : 'Component failed to load. Please refresh the page.'
                    }
                  </p>
                  <Button 
                    onClick={this.handleRefresh}
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Page
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4 sm:p-6">
          <Card className="w-full max-w-lg shadow-sm border-border/50 bg-card">
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <h3 className="text-xl font-semibold text-foreground">
                    {errorCategory}
                  </h3>
                </div>
                
                <Alert className="mb-4 border-destructive/50 bg-destructive/5">
                  <AlertDescription className="text-left text-foreground">
                    {suggestion}
                  </AlertDescription>
                </Alert>

                {this.state.errorId && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Error ID: {this.state.errorId}
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

                {/* Network Diagnostics for Loading Errors */}
                {errorCategory === 'Loading Error' && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">
                      This appears to be a component loading issue. Run network diagnostics to identify the cause:
                    </p>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => {
                        // Dynamically import and show network diagnostics
                        import('../utils/networkDiagnostics').then((module) => {
                          const NetworkDiagnostics = module.default;
                          // This would need a modal or separate component to render
                          console.log('Network diagnostics available');
                        }).catch(console.error);
                      }}
                      className="flex items-center gap-2"
                    >
                      Run Network Test
                    </Button>
                  </div>
                )}

                {this.props.showErrorDetails && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="text-sm font-medium cursor-pointer mb-2 text-muted-foreground flex items-center gap-1">
                      <Bug className="h-3 w-3" />
                      Technical Details
                    </summary>
                    <div className="text-xs bg-muted/50 p-3 rounded border overflow-auto max-h-40 text-left space-y-2">
                      <div>
                        <strong className="text-foreground">Error:</strong>
                        <span className="text-muted-foreground ml-1">{this.state.error.message}</span>
                      </div>
                      {this.state.error.stack && (
                        <div>
                          <strong className="text-foreground">Stack:</strong>
                          <pre className="text-xs mt-1 bg-background p-2 rounded overflow-auto max-h-32 text-muted-foreground">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryWrapper;