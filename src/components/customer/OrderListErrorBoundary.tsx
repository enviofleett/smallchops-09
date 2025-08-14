import React from 'react';
import { EnhancedErrorBoundary } from '@/components/ui/enhanced-error-boundary';
import { toast } from 'sonner';

interface OrderListErrorBoundaryProps {
  children: React.ReactNode;
}

export const OrderListErrorBoundary: React.FC<OrderListErrorBoundaryProps> = ({ children }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('🚨 Order list error captured:', { error, errorInfo });
    
    // Log specific error patterns for debugging
    if (error.message.includes('products') || error.message.includes('order_items')) {
      console.error('💾 Database relationship error detected:', error.message);
      toast.error('Database connection issue detected. Please try refreshing.');
    } else if (error.message.includes('aborted')) {
      console.log('🔄 Request was aborted (normal for component unmounting)');
      return; // Don't show error for aborted requests
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.error('🔐 Authentication error detected:', error.message);
      toast.error('Authentication issue. Please sign in again.');
    } else {
      console.error('❌ Unexpected order loading error:', error.message);
      toast.error('Failed to load orders. Please try again.');
    }

    // Track error for analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: `Order List Error: ${error.message}`,
        fatal: false
      });
    }
  };

  return (
    <EnhancedErrorBoundary
      onError={handleError}
      title="Unable to load orders"
      description="We're having trouble loading your order history. This might be due to a temporary connection issue."
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};