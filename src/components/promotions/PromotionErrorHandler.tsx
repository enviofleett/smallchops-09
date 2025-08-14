import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PromotionError {
  code: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

interface PromotionErrorHandlerProps {
  error: PromotionError | null;
  onDismiss?: () => void;
  className?: string;
}

const errorMessages: Record<string, { title: string; description: string }> = {
  'PROMOTION_EXPIRED': {
    title: 'Promotion Expired',
    description: 'This promotion is no longer valid. Please check for current offers.'
  },
  'PROMOTION_NOT_FOUND': {
    title: 'Invalid Promotion Code',
    description: 'The promotion code you entered is not valid. Please check the code and try again.'
  },
  'MINIMUM_ORDER_NOT_MET': {
    title: 'Minimum Order Required',
    description: 'Your order total must meet the minimum amount required for this promotion.'
  },
  'USAGE_LIMIT_REACHED': {
    title: 'Promotion Limit Reached',
    description: 'This promotion has reached its usage limit and is no longer available.'
  },
  'PROMOTION_NOT_APPLICABLE_TODAY': {
    title: 'Promotion Not Available Today',
    description: 'This promotion is only valid on specific days of the week.'
  },
  'PROMOTION_INACTIVE': {
    title: 'Promotion Inactive',
    description: 'This promotion is currently inactive. Please contact support if you believe this is an error.'
  },
  'CART_EMPTY': {
    title: 'Empty Cart',
    description: 'Add items to your cart before applying a promotion code.'
  },
  'PROMOTION_ALREADY_APPLIED': {
    title: 'Promotion Already Applied',
    description: 'This promotion is already active on your order.'
  }
};

export function PromotionErrorHandler({ 
  error, 
  onDismiss, 
  className 
}: PromotionErrorHandlerProps) {
  if (!error) return null;

  const errorInfo = errorMessages[error.code] || {
    title: 'Promotion Error',
    description: error.message || 'An unexpected error occurred with the promotion.'
  };

  const getIcon = () => {
    switch (error.type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (error.type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'destructive';
    }
  };

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <div className="flex-1">
        <div className="font-medium">{errorInfo.title}</div>
        <AlertDescription className="mt-1">
          {errorInfo.description}
        </AlertDescription>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 hover:bg-transparent"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Alert>
  );
}

export function formatPromotionError(error: any): PromotionError | null {
  if (!error) return null;

  // Handle API response errors
  if (error.response?.data?.error) {
    return {
      code: error.response.data.code || 'UNKNOWN_ERROR',
      message: error.response.data.error,
      type: 'error'
    };
  }

  // Handle validation errors
  if (error.validation) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message || 'Please check your input and try again.',
      type: 'warning'
    };
  }

  // Handle network errors
  if (error.message?.includes('network') || error.message?.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server. Please check your internet connection.',
      type: 'error'
    };
  }

  // Default error
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred.',
    type: 'error'
  };
}