import React from 'react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ErrorFallback } from '@/components/ErrorFallback';

interface OrderListErrorBoundaryProps {
  children: React.ReactNode;
}

export const OrderListErrorBoundary: React.FC<OrderListErrorBoundaryProps> = ({ children }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🚨 Order list error:', { error, errorInfo });
    
    // Log specific order-related errors for debugging
    if (error.message.includes('products') || error.message.includes('order_items')) {
      console.error('💾 Database relationship error detected:', error.message);
    }
  };

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={
        <ErrorFallback
          message="Unable to load orders"
          error={undefined}
          onRetry={() => window.location.reload()}
          showDetails={false}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
};