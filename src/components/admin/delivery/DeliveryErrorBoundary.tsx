import React, { Component, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface DeliveryErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class DeliveryErrorBoundary extends Component<
  DeliveryErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: DeliveryErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Delivery Dashboard Error:', error, errorInfo);
    
    // Log error to Supabase for monitoring
    this.logError(error, errorInfo);
  }

  private async logError(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'delivery_dashboard_error',
          category: 'Error Handling',
          message: `Delivery dashboard error: ${error.message}`,
          new_values: {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
          }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 m-4">
          <CardContent className="text-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Delivery Dashboard Error</h2>
              <p className="text-muted-foreground mb-4">
                Something went wrong while loading the delivery management dashboard.
              </p>
              {this.state.error && (
                <Alert variant="destructive" className="mb-4 text-left">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error Details:</strong> {this.state.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.handleRetry} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact system administrator.
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}