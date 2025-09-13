import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorToastProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  retryLabel?: string;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  title = "Error",
  message,
  onRetry,
  onDismiss,
  className,
  retryLabel = "Try Again"
}) => {
  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md",
        "sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0",
        "bg-white border border-red-200 rounded-lg shadow-xl ring-1 ring-red-100",
        "p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-300",
        className
      )}
      role="alert"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-black leading-5">
              {title}
            </h4>
          </div>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0 text-gray-600 hover:text-black hover:bg-gray-100 flex-shrink-0 min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>

      {/* Message */}
      <div className="text-sm text-gray-800 leading-relaxed pl-8">
        {message}
      </div>

      {/* Actions */}
      {onRetry && (
        <div className="flex justify-end pt-2 pl-8">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="min-h-[44px] bg-white border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 touch-manipulation flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{retryLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

// Hook for showing error toasts
export const useErrorToast = () => {
  const [errorToast, setErrorToast] = React.useState<{
    title?: string;
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
  } | null>(null);

  const showError = React.useCallback((
    message: string,
    options?: {
      title?: string;
      onRetry?: () => void;
      retryLabel?: string;
      duration?: number;
    }
  ) => {
    setErrorToast({
      title: options?.title,
      message,
      onRetry: options?.onRetry,
      retryLabel: options?.retryLabel
    });

    // Auto dismiss after duration (default 5 seconds)
    if (!options?.onRetry) {
      setTimeout(() => {
        setErrorToast(null);
      }, options?.duration || 5000);
    }
  }, []);

  const hideError = React.useCallback(() => {
    setErrorToast(null);
  }, []);

  return {
    errorToast,
    showError,
    hideError
  };
};