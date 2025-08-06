
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface PaymentErrorHandlerProps {
  error: string;
  onRetry?: () => void;
  onFallback?: () => void;
}

export const PaymentErrorHandler: React.FC<PaymentErrorHandlerProps> = ({
  error,
  onRetry,
  onFallback
}) => {
  const getErrorMessage = (error: string) => {
    if (error.includes('invalid public key') || error.includes('Authentication failed')) {
      return {
        title: "Payment Configuration Issue",
        description: "There's an issue with the payment configuration. Please contact support.",
        showRetry: false,
        showFallback: false
      };
    }

    if (error.includes('network') || error.includes('connection')) {
      return {
        title: "Connection Problem",
        description: "Unable to connect to payment service. Please check your internet connection and try again.",
        showRetry: true,
        showFallback: true
      };
    }

    if (error.includes('We could not start this transaction')) {
      return {
        title: "Transaction Failed",
        description: "Unable to initialize payment. This may be due to configuration issues or temporary service problems.",
        showRetry: true,
        showFallback: true
      };
    }

    return {
      title: "Payment Error",
      description: error || "An unexpected error occurred during payment initialization.",
      showRetry: true,
      showFallback: true
    };
  };

  const errorInfo = getErrorMessage(error);

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{errorInfo.title}</AlertTitle>
      <AlertDescription className="mt-2">
        {errorInfo.description}
        
        <div className="flex gap-2 mt-4">
          {errorInfo.showRetry && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          
          {errorInfo.showFallback && onFallback && (
            <Button variant="secondary" size="sm" onClick={onFallback}>
              Use Alternative Payment
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
