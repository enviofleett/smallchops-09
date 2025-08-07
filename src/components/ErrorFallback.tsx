import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorFallbackProps {
  error?: Error;
  message?: string;
  onRetry?: () => void;
  showDetails?: boolean;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  message = "Something went wrong",
  onRetry,
  showDetails = false
}) => {
  return (
    <div className="flex items-center justify-center p-6">
      <Alert className="max-w-lg">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <div>
            <h4 className="font-medium">{message}</h4>
            {error && showDetails && (
              <p className="text-sm text-muted-foreground mt-1">
                {error.message}
              </p>
            )}
          </div>
          {onRetry && (
            <Button 
              onClick={onRetry}
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
};