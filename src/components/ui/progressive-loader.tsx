import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Wifi, WifiOff, Clock, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetwork } from '@/components/network/NetworkProvider';

interface ProgressiveLoaderProps {
  isLoading: boolean;
  error?: any; // Can be Error, string, or classified error object
  data?: any;
  children: React.ReactNode;
  skeletonType?: 'product' | 'table' | 'chart' | 'card';
  retryFn?: () => void;
  timeout?: number; // Timeout in milliseconds
}

interface ProductSkeletonProps {
  count?: number;
}

const ProductSkeleton = ({ count = 6 }: ProductSkeletonProps) => (
  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="overflow-hidden">
        <CardContent className="p-0">
          <Skeleton className="aspect-square w-full" />
          <div className="p-3 sm:p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const TableSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full" />
    ))}
  </div>
);

const ChartSkeleton = () => (
  <Card>
    <CardContent className="p-6">
      <Skeleton className="h-6 w-32 mb-4" />
      <Skeleton className="h-64 w-full" />
    </CardContent>
  </Card>
);

const CardSkeleton = () => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const getErrorIcon = (errorType?: string) => {
  switch (errorType) {
    case 'network':
      return <WifiOff className="h-12 w-12 text-red-500" />;
    case 'timeout':
      return <Clock className="h-12 w-12 text-amber-500" />;
    case 'auth':
    case 'permission':
      return <Shield className="h-12 w-12 text-orange-500" />;
    case 'server':
      return <AlertTriangle className="h-12 w-12 text-red-500" />;
    default:
      return <AlertCircle className="h-12 w-12 text-destructive" />;
  }
};

const getErrorVariant = (severity?: string) => {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'default';
    default:
      return 'destructive';
  }
};

export const ProgressiveLoader = ({
  isLoading,
  error,
  data,
  children,
  skeletonType = 'card',
  retryFn,
  timeout = 10000
}: ProgressiveLoaderProps) => {
  const [showTimeoutError, setShowTimeoutError] = useState(false);
  const { isOnline, connectionQuality, apiAvailable } = useNetwork();

  useEffect(() => {
    if (isLoading && timeout > 0) {
      const timer = setTimeout(() => {
        setShowTimeoutError(true);
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [isLoading, timeout]);

  useEffect(() => {
    if (!isLoading) {
      setShowTimeoutError(false);
    }
  }, [isLoading]);

  // Show timeout error if loading takes too long
  if (showTimeoutError && isLoading) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Taking longer than expected</h3>
              <p className="text-muted-foreground">
                The content is taking longer to load than usual. This might be due to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                <li>Network connectivity issues</li>
                <li>Server response delays</li>
                <li>High traffic on the service</li>
              </ul>
            </div>
            {!isOnline && (
              <Alert variant="destructive">
                <WifiOff className="h-4 w-4" />
                <AlertDescription>You appear to be offline. Please check your connection.</AlertDescription>
              </Alert>
            )}
            {retryFn && (
              <Button onClick={retryFn} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Show error state with enhanced messaging
  if (error) {
    // Handle classified errors (from our new system)
    if (typeof error === 'object' && error.type && error.message) {
      const classifiedError = error;
      return (
        <Alert variant={getErrorVariant(classifiedError.severity)} className="mx-auto max-w-2xl">
          {getErrorIcon(classifiedError.type)}
          <AlertDescription>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{classifiedError.message}</h3>
                {classifiedError.suggestedActions && classifiedError.suggestedActions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">What you can do:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {classifiedError.suggestedActions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {classifiedError.errorId && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Error ID: {classifiedError.errorId}
                  </p>
                )}
              </div>
              
              {/* Network status indicator */}
              {(!isOnline || !apiAvailable) && (
                <Alert variant="destructive">
                  <WifiOff className="h-4 w-4" />
                  <AlertDescription>
                    {!isOnline 
                      ? "You're currently offline. Please check your internet connection."
                      : "API services appear to be unavailable. Please try again later."
                    }
                  </AlertDescription>
                </Alert>
              )}
              
              {connectionQuality === 'poor' && isOnline && (
                <Alert variant="default">
                  <Wifi className="h-4 w-4" />
                  <AlertDescription>
                    Poor connection quality detected. This may cause loading issues.
                  </AlertDescription>
                </Alert>
              )}
              
              {retryFn && classifiedError.retryable && (
                <Button onClick={retryFn} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    
    // Handle legacy errors (Error objects or strings)
    const errorMessage = error?.message || error?.toString() || 'Something went wrong while loading this content.';
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Failed to load content</h3>
              <p className="text-muted-foreground">{errorMessage}</p>
            </div>
            
            {!isOnline && (
              <Alert variant="destructive">
                <WifiOff className="h-4 w-4" />
                <AlertDescription>You appear to be offline. Please check your connection.</AlertDescription>
              </Alert>
            )}
            
            {retryFn && (
              <Button onClick={retryFn} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Show loading skeleton
  if (isLoading) {
    switch (skeletonType) {
      case 'product':
        return <ProductSkeleton />;
      case 'table':
        return <TableSkeleton />;
      case 'chart':
        return <ChartSkeleton />;
      case 'card':
      default:
        return <CardSkeleton />;
    }
  }

  // Show children when data is loaded
  return <>{children}</>;
};

export default ProgressiveLoader;