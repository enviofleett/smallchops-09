import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home, Phone, Mail } from 'lucide-react';

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

    // Enhanced production error tracking
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // Log to console for immediate debugging
      console.error('🚨 Production Orders Error:', {
        errorId: `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customer: this.props.customerEmail,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    }

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

      // Enhanced Supabase-specific error mapping
      const errorMessage = this.state.error?.message || 'Unknown error occurred';
      const errorCode = (this.state.error as any)?.code || (this.state.error as any)?.error_code;
      
      let userMessage = 'Something went wrong while loading your orders.';
      let suggestion = 'Please try again or refresh the page.';
      let isRetriable = true;

      // Specific Supabase error handling
      switch (errorCode) {
        case '42501': // insufficient_privilege
          userMessage = 'Access denied';
          suggestion = 'Please contact support to verify your account permissions.';
          isRetriable = false;
          break;
        case '42P01': // undefined_table
          userMessage = 'Service temporarily unavailable';
          suggestion = 'Orders service is being updated. Please try again in a few minutes.';
          break;
        case 'PGRST301': // JWT expired
          userMessage = 'Session expired';
          suggestion = 'Please refresh the page and try again.';
          break;
        case 'PGRST116': // schema_cache_lookup
          userMessage = 'Connection issue';
          suggestion = 'Database connection problem. Please try again in a moment.';
          break;
        default:
          // Generic message type detection
          if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
            userMessage = 'Connection problem';
            suggestion = 'Please check your internet connection and try again.';
          } else if (errorMessage.includes('JWT') || errorMessage.includes('token') || errorMessage.includes('auth')) {
            userMessage = 'Authentication issue';
            suggestion = 'Please refresh the page to re-authenticate.';
          } else if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
            userMessage = 'Access denied';
            suggestion = 'Please contact support if this issue persists.';
            isRetriable = false;
          }
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

            <div className="flex flex-col sm:flex-row gap-3">
              {isRetriable && (
                <Button 
                  onClick={this.handleRetry}
                  variant="default"
                  className="flex items-center"
                  disabled={this.state.retryCount >= 3}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {this.state.retryCount >= 3 ? 'Max Retries Reached' : `Try Again (${3 - this.state.retryCount} left)`}
                </Button>
              )}
              
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

            {/* Enhanced support contact section */}
            {(this.state.retryCount >= 3 || !isRetriable) && (
              <div className="mt-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <h4 className="font-medium text-warning-foreground mb-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Need Help?
                </h4>
                <p className="text-sm text-warning-foreground/80 mb-3">
                  If this issue persists, our support team is here to help:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <a 
                    href="mailto:support@startersmallchops.com" 
                    className="flex items-center p-2 bg-background rounded border hover:bg-muted transition-colors"
                  >
                    <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Email Support</span>
                  </a>
                  <a 
                    href="tel:+2348073011100" 
                    className="flex items-center p-2 bg-background rounded border hover:bg-muted transition-colors"
                  >
                    <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Call +234 807 3011 100</span>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-3 font-mono">
                  Reference: {this.props.customerEmail} | {new Date().toISOString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ProductionOrdersErrorBoundary;