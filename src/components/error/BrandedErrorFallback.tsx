import React from 'react';
import { AlertTriangle, RefreshCw, Home, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RetryButton } from './RetryButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

interface BrandedErrorFallbackProps {
  error?: Error;
  message?: string;
  onRetry?: () => void;
  showDetails?: boolean;
  maxRetries?: number;
  currentRetries?: number;
  isNetworkError?: boolean;
}

export const BrandedErrorFallback: React.FC<BrandedErrorFallbackProps> = ({
  error,
  message = "Something went wrong",
  onRetry,
  showDetails = false,
  maxRetries = 3,
  currentRetries = 0,
  isNetworkError = false
}) => {
  const { data: businessSettings, isLoading } = useBusinessSettings();
  
  const remainingAttempts = maxRetries - currentRetries;
  const canRetry = remainingAttempts > 0 && onRetry;

  // Use business settings for branding
  const logoUrl = businessSettings?.logo_url || '/lovable-uploads/4b7e8feb-69d6-41e6-bf51-31bc57291f4a.png';
  const businessName = businessSettings?.name || 'Starters';
  const primaryColor = businessSettings?.primary_color || 'hsl(var(--primary))';

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 space-y-6">
      {/* Branded Logo */}
      <div className="flex items-center justify-center mb-4">
        <img 
          src={logoUrl} 
          alt={`${businessName} Logo`}
          className="h-12 w-auto object-contain"
          onError={(e) => {
            e.currentTarget.src = '/lovable-uploads/4b7e8feb-69d6-41e6-bf51-31bc57291f4a.png';
          }}
        />
      </div>

      <Alert className="max-w-lg">
        <div className="flex items-center space-x-2 mb-3">
          {isNetworkError ? (
            <Wifi className="h-5 w-5 text-destructive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          <h4 className="font-semibold text-lg">
            {isNetworkError ? 'Connection Problem' : 'Oops! Something went wrong'}
          </h4>
        </div>
        
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isNetworkError 
              ? "We're having trouble connecting to our servers. Please check your internet connection and try again."
              : message
            }
          </p>
          
          {error && showDetails && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {onRetry && (
              <RetryButton
                onRetry={onRetry}
                maxRetries={maxRetries}
                currentRetries={currentRetries}
              />
            )}
            
            <Link to="/">
              <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </Link>
          </div>
          
          {isNetworkError && (
            <div className="text-xs text-muted-foreground pt-2">
              <p>• Check your internet connection</p>
              <p>• Try refreshing the page</p>
              <p>• Contact support if the problem persists</p>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
};