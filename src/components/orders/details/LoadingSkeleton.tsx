import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  lines?: number;
  showHeader?: boolean;
  className?: string;
}

/**
 * Reusable loading skeleton for order details sections
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  lines = 3,
  showHeader = true,
  className = ""
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-32" />
        </div>
      )}
      
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Specific loading skeleton for financial breakdown
 */
export const FinancialBreakdownSkeleton: React.FC = () => {
  return (
    <LoadingSkeleton 
      lines={5}
      showHeader={true}
      className="space-y-3"
    />
  );
};

/**
 * Specific loading skeleton for driver section
 */
export const DriverSectionSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-28" />
      </div>
      
      <div className="bg-muted/50 rounded-lg p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Specific loading skeleton for order items
 */
export const OrderItemsSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-32" />
      </div>
      
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-muted/50 rounded-lg p-4">
            <div className="flex gap-4">
              <Skeleton className="w-16 h-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="space-y-1 text-right">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Specific loading skeleton for fulfillment section
 */
export const FulfillmentSectionSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-36" />
      </div>
      
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    </div>
  );
};