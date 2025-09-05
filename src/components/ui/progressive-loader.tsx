import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProgressiveLoaderProps {
  isLoading: boolean;
  error?: Error | null;
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
      <Card className="p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Taking longer than expected</h3>
            <p className="text-muted-foreground">
              The content is taking longer to load than usual. This might be due to network issues.
            </p>
          </div>
          {retryFn && (
            <Button onClick={retryFn} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Show error state
  if (error) {
    const getErrorInfo = (error: Error) => {
      const message = error.message || '';
      
      // Categorize common production errors
      if (message.includes('Edge Function returned a non-2xx status code') || message.includes('FunctionsHttpError')) {
        return {
          title: 'Service Temporarily Unavailable',
          description: 'Our data service is currently experiencing issues. Please try again in a few moments.',
          variant: 'warning' as const
        };
      }
      
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        return {
          title: 'Connection Problem',
          description: 'Please check your internet connection and try again.',
          variant: 'warning' as const
        };
      }
      
      if (message.includes('timeout') || message.includes('took too long')) {
        return {
          title: 'Request Timed Out',
          description: 'The request is taking longer than expected. Please try again.',
          variant: 'warning' as const
        };
      }
      
      // Default error for unknown cases
      return {
        title: 'Unable to Load Data',
        description: 'Something went wrong while loading this content. Our team has been notified.',
        variant: 'error' as const
      };
    };

    const errorInfo = getErrorInfo(error);
    const iconColor = errorInfo.variant === 'warning' ? 'text-amber-500' : 'text-destructive';

    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <AlertCircle className={`h-12 w-12 ${iconColor} mx-auto`} />
          <div>
            <h3 className="text-lg font-semibold">{errorInfo.title}</h3>
            <p className="text-muted-foreground">
              {errorInfo.description}
            </p>
          </div>
          {retryFn && (
            <Button onClick={retryFn} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </Card>
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