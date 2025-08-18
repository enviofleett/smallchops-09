
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RegistrationErrorHandlerProps {
  error: string;
  onRetry: () => void;
  onReset: () => void;
}

export const RegistrationErrorHandler: React.FC<RegistrationErrorHandlerProps> = ({
  error,
  onRetry,
  onReset
}) => {
  const isNetworkError = error.toLowerCase().includes('network') || 
                         error.toLowerCase().includes('fetch') ||
                         error.toLowerCase().includes('timeout');
  
  const isDatabaseError = error.toLowerCase().includes('database') ||
                         error.toLowerCase().includes('internal server');

  const getErrorMessage = () => {
    if (isNetworkError) {
      return "Connection issue detected. Please check your internet connection and try again.";
    }
    
    if (isDatabaseError) {
      return "We're experiencing technical difficulties. Our team has been notified and is working on a fix.";
    }
    
    if (error.includes('already registered') || error.includes('already exists')) {
      return "An account with this email already exists. Try signing in instead.";
    }
    
    if (error.includes('weak password') || error.includes('password')) {
      return "Please choose a stronger password with at least 8 characters, including letters and numbers.";
    }
    
    return error || "Registration failed. Please try again.";
  };

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium text-destructive mb-2">Registration Failed</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {getErrorMessage()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
            >
              Start Over
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
