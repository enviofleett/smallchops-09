import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  orderId?: string;
  orderNumber?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

class ProductionOrderErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

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
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Production Order Error:', {
      orderId: this.props.orderId,
      orderNumber: this.props.orderNumber,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Log to audit trail
    this.logErrorToAuditTrail(error, errorInfo);

    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    toast.error(`Order management error${this.props.orderNumber ? ` for #${this.props.orderNumber}` : ''}: ${error.message}`);
  }

  private async logErrorToAuditTrail(error: Error, errorInfo: any) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      await supabase.functions.invoke('order-manager', {
        body: {
          action: 'log_admin_error',
          order_id: this.props.orderId,
          errorType: 'order_management_component_error',
          error: {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            orderNumber: this.props.orderNumber,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (auditError) {
      console.warn('Failed to log error to audit trail:', auditError);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
      
      this.props.onReset?.();
      
      toast.success('Retrying order management...');
    } else {
      toast.error('Maximum retry attempts reached. Please refresh the page.');
      window.location.reload();
    }
  };

  handleGoHome = () => {
    window.location.href = '/admin/orders';
  };

  handleRefreshPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const canRetry = this.state.retryCount < this.maxRetries;

      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Order Management Error
              {this.props.orderNumber && (
                <span className="text-sm font-normal text-muted-foreground">
                  (Order #{this.props.orderNumber})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">Error Details:</p>
              <p className="text-sm text-muted-foreground font-mono">
                {error?.message || 'An unexpected error occurred'}
              </p>
              {this.state.retryCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Retry attempts: {this.state.retryCount}/{this.maxRetries}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Suggested Actions:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Check your internet connection</li>
                <li>• Verify the order still exists in the system</li>
                <li>• Try refreshing the page</li>
                <li>• Contact support if the issue persists</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              {canRetry && (
                <Button onClick={this.handleRetry} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again ({this.maxRetries - this.state.retryCount} left)
                </Button>
              )}
              
              <Button onClick={this.handleRefreshPage} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
              
              <Button onClick={this.handleGoHome} variant="outline" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4">
                <summary className="text-sm font-medium cursor-pointer text-muted-foreground">
                  Developer Details (Development Only)
                </summary>
                <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ProductionOrderErrorBoundary;