import React, { Component, ErrorInfo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Copy, Bug, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string;
  showDetails: boolean;
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount: number;
}

/**
 * Live Development Error Boundary for admin functions
 * Enhanced for live/production development with better error tracking
 */
export class ProductionErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private isLiveDevelopment = process.env.NODE_ENV === 'development' || 
                            window.location.hostname === 'localhost' ||
                            window.location.hostname.includes('staging') ||
                            window.location.hostname.includes('dev');
  
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: '',
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    const errorDetails = {
      errorId: this.state.errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      isLiveDevelopment: this.isLiveDevelopment
    };

    // Enhanced logging for live development
    console.group('🚨 Error Boundary Triggered');
    console.error('Error ID:', this.state.errorId);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.table(errorDetails);
    console.groupEnd();

    // Report to monitoring service
    this.reportError(errorDetails);
  }

  // Enhanced error reporting for live development
  private reportError = async (errorDetails: any) => {
    try {
      // For live development, we can use multiple reporting strategies
      if (this.isLiveDevelopment) {
        // Store in localStorage for debugging
        const errors = JSON.parse(localStorage.getItem('dev_errors') || '[]');
        errors.push(errorDetails);
        localStorage.setItem('dev_errors', JSON.stringify(errors.slice(-10))); // Keep last 10 errors
      }

      // You can add external monitoring services here
      // Example: Sentry, LogRocket, Bugsnag, etc.
      console.log('📊 Error reported:', errorDetails.errorId);
    } catch (reportingError) {
      console.warn('Failed to report error:', reportingError);
    }
  };

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        showDetails: false
      }));
    } else {
      // In live development, ask before reloading
      if (this.isLiveDevelopment) {
        const shouldReload = window.confirm(
          'Maximum retry attempts reached. Would you like to reload the page? (This will lose unsaved work)'
        );
        if (shouldReload) {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    }
  };

  copyErrorDetails = () => {
    const errorText = `
Error ID: ${this.state.errorId}
Error: ${this.state.error?.message}
Stack: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
    `.trim();
    
    navigator.clipboard.writeText(errorText).then(() => {
      toast.success('Error details copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy error details');
    });
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      
      if (FallbackComponent) {
        return (
          <FallbackComponent 
            error={this.state.error}
            resetError={this.handleRetry}
            retryCount={this.state.retryCount}
          />
        );
      }

      return (
        <div className="p-4 space-y-4 max-w-4xl mx-auto">
          {/* Error Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-destructive">Critical Error Occurred</h2>
                <p className="text-sm text-muted-foreground">Error ID: {this.state.errorId}</p>
              </div>
            </div>
            {this.isLiveDevelopment && (
              <Badge variant="outline" className="border-orange-500 text-orange-700">
                <Bug className="h-3 w-3 mr-1" />
                Live Development
              </Badge>
            )}
          </div>

          {/* Error Message */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{this.state.error.message}</p>
                <p className="text-sm">
                  {this.state.retryCount < this.maxRetries ? (
                    `Retry attempt ${this.state.retryCount}/${this.maxRetries}. You can try again or refresh the page.`
                  ) : (
                    'Maximum retry attempts reached. Consider refreshing the page or checking the error details below.'
                  )}
                </p>
              </div>
            </AlertDescription>
          </Alert>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={this.handleRetry}
              disabled={this.state.retryCount >= this.maxRetries}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {this.state.retryCount >= this.maxRetries ? 'Max Retries Reached' : 'Try Again'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>

            {this.isLiveDevelopment && (
              <>
                <Button 
                  variant="outline" 
                  onClick={this.copyErrorDetails}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Error Details
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2"
                >
                  <Bug className="h-4 w-4" />
                  {this.state.showDetails ? 'Hide' : 'Show'} Error Details
                </Button>
              </>
            )}
          </div>

          {/* Enhanced Error Details for Live Development */}
          {this.isLiveDevelopment && this.state.showDetails && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-muted rounded-lg border">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Error Details (Live Development)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Error Message:</strong>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                      {this.state.error.message}
                    </pre>
                  </div>
                  
                  <div>
                    <strong>Error ID:</strong>
                    <pre className="mt-1 p-2 bg-background rounded text-xs">
                      {this.state.errorId}
                    </pre>
                  </div>
                  
                  <div>
                    <strong>Retry Count:</strong>
                    <pre className="mt-1 p-2 bg-background rounded text-xs">
                      {this.state.retryCount}/{this.maxRetries}
                    </pre>
                  </div>
                  
                  <div>
                    <strong>Timestamp:</strong>
                    <pre className="mt-1 p-2 bg-background rounded text-xs">
                      {new Date().toISOString()}
                    </pre>
                  </div>
                </div>

                <div className="mt-4">
                  <strong>Stack Trace:</strong>
                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </div>

                {this.state.errorInfo && (
                  <div className="mt-4">
                    <strong>Component Stack:</strong>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Debugging Tips:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 mt-1 list-disc list-inside space-y-1">
                    <li>Check the browser console for additional error details</li>
                    <li>Look at the component stack to identify the failing component</li>
                    <li>Error details have been saved to localStorage (key: 'dev_errors')</li>
                    <li>Try refreshing the page if this is a transient issue</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Basic error info for production */}
          {!this.isLiveDevelopment && this.state.error && (
            <div className="mt-4 p-4 bg-muted rounded border text-sm">
              <p className="font-medium">Error Reference: {this.state.errorId}</p>
              <p className="text-muted-foreground mt-1">
                Please contact support with this error reference if the problem persists.
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}