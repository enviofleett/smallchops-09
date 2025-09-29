/**
 * Safe Order Data Renderer Component
 * Provides defensive rendering to prevent React errors with corrupted order data
 */

import React, { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  validateOrderData, 
  createFallbackOrderData, 
  validateForReactRendering,
  ValidatedOrderData 
} from '@/utils/orderDataValidation';
import { logProductionError } from '@/utils/productionSafeData';

interface SafeOrderDataRendererProps {
  order: any;
  children: (validatedOrder: ValidatedOrderData) => ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, originalData: any) => void;
  componentName?: string;
}

export const SafeOrderDataRenderer: React.FC<SafeOrderDataRendererProps> = ({
  order,
  children,
  fallbackComponent,
  onError,
  componentName = 'OrderComponent'
}) => {
  try {
    // First, validate the order data
    const validatedOrder = validateOrderData(order);
    
    if (!validatedOrder) {
      // If validation fails, use fallback data
      const fallback = createFallbackOrderData(order);
      
      const validationError = new Error(`Order data validation failed for order ${order?.id || 'unknown'}`);
      logProductionError(validationError, `${componentName} data validation`, {
        orderId: order?.id,
        orderNumber: order?.order_number,
        failedValidation: true
      });
      
      onError?.(validationError, order);
      
      if (fallbackComponent) {
        return <>{fallbackComponent}</>;
      }
      
      return (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Order data validation failed</p>
                <p className="text-sm text-muted-foreground">
                  Some order information may be incomplete or corrupted. Using safe defaults.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    
    // Additional safety check for React rendering
    if (!validateForReactRendering(validatedOrder, componentName)) {
      throw new Error('Order data contains elements that cannot be safely rendered');
    }
    
    // Render with validated data
    return <>{children(validatedOrder)}</>;
    
  } catch (error) {
    const renderError = error as Error;
    
    logProductionError(renderError, `${componentName} rendering error`, {
      orderId: order?.id,
      orderNumber: order?.order_number,
      errorType: 'rendering'
    });
    
    onError?.(renderError, order);
    
    // Use fallback component if provided
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }
    
    // Default error state
    return (
      <Alert className="border-destructive/50 bg-destructive/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Unable to display order information</p>
              <p className="text-sm text-muted-foreground">
                There was an error processing the order data. Please refresh the page.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
};

/**
 * Higher-order component for safe order data rendering
 */
export function withSafeOrderData<P extends { order: any }>(
  Component: React.ComponentType<P & { order: ValidatedOrderData }>,
  componentName?: string
) {
  return function SafeOrderDataWrapper(props: P) {
    return (
      <SafeOrderDataRenderer 
        order={props.order}
        componentName={componentName || Component.displayName || Component.name}
      >
        {(validatedOrder) => (
          <Component {...props} order={validatedOrder} />
        )}
      </SafeOrderDataRenderer>
    );
  };
}