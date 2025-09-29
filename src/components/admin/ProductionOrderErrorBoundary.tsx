import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { toast } from 'sonner';
import { safeStringify } from '@/utils/productionSafeData';

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
      
      // Log to audit_logs table directly instead of edge function
      await supabase.from('audit_logs').insert({
        action: 'order_management_component_error',
        category: 'Error Boundary',
        message: `Production Order Error: ${error.message}`,
        entity_id: this.props.orderId,
        new_values: {
          error_message: error.message,
          error_stack: error.stack,
          component_stack: errorInfo.componentStack,
          order_number: this.props.orderNumber,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      });
    } catch (auditError) {
      // Fail silently in production to prevent error boundary loops
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

  private getProductionSafeErrorMessage = (error: Error | null): string => {
    if (!error) return 'An unexpected error occurred';
    
    const errorMessage = safeStringify(error.message);
    
    // Enhanced React object rendering error detection
    if (errorMessage.includes('Objects are not valid as a React child')) {
      return 'Address or order data contains formatting errors that cannot be displayed. This typically occurs when order details are corrupted or in an unexpected format.';
    }
    
    // Enhanced common error patterns
    if (errorMessage.includes('Cannot read properties') || errorMessage.includes('Cannot read property')) {
      return 'Order data is missing required information. Some details may not display correctly.';
    }
    
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return 'Network connectivity issue: Unable to load current order data. Please check your connection.';
    }
    
    if (errorMessage.includes('ChunkLoadError') || errorMessage.includes('Loading chunk')) {
      return 'Application loading error: Please refresh the page to load the latest version.';
    }
    
    // Minified React errors (common in production)
    if (errorMessage.includes('Minified React error #31')) {
      return 'React rendering error: Invalid data format detected in order details. This is usually caused by corrupted address or order information.';
    }
    
    // More specific React error patterns
    if (errorMessage.includes('Minified React error #130')) {
      return 'React component error: Data validation failed during rendering. Please refresh to reload the order data.';
    }
    
    if (errorMessage.includes('Minified React error')) {
      return 'React application error: Please refresh the page to restore functionality.';
    }
    
    // Address/object rendering specific errors
    if (errorMessage.toLowerCase().includes('address') && (errorMessage.includes('render') || errorMessage.includes('child'))) {
      return 'Order address information contains invalid data that cannot be displayed safely. The address may be corrupted in the database.';
    }
    
    // JSON parsing errors related to address data
    if (errorMessage.includes('JSON') && errorMessage.toLowerCase().includes('address')) {
      return 'Order address data is malformed (invalid JSON format). This requires database correction.';
    }
    
    // Return sanitized error message for production
    return errorMessage.length > 200 
      ? errorMessage.substring(0, 200) + '...' 
      : errorMessage;
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
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">Production Error Details:</p>
              <p className="text-sm text-muted-foreground font-mono break-words">
                {this.getProductionSafeErrorMessage(error)}
              </p>
              {this.state.retryCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Retry attempts: {this.state.retryCount}/{this.maxRetries}
                </p>
              )}
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <p className="text-sm text-accent-foreground font-medium">
                <strong>Immediate Actions:</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Refresh the page immediately to reload order data</li>
                <li>• Check if order address information is corrupted</li>
                <li>• Verify all order details display correctly after refresh</li>
                <li>• Report persistent errors to system administrator</li>
                <li>• If error persists, the order may need database cleanup</li>
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