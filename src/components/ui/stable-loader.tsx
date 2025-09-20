import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StableLoaderProps {
  count?: number;
  className?: string;
}

export const StableProductLoader = ({ count = 9, className }: StableLoaderProps) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-0">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4 space-y-2">
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
};

export const StablePageLoader = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="h-16 bg-card border-b border-border" />
      
      {/* Hero section skeleton */}
      <section className="bg-background py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
            <div className="text-center lg:text-left order-2 lg:order-1">
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-6 w-3/4 mb-6" />
              <Skeleton className="h-12 w-48 mx-auto lg:mx-0" />
            </div>
            <div className="flex justify-center order-1 lg:order-2">
              <Skeleton className="w-64 h-64 rounded-2xl" />
            </div>
            <div className="flex justify-center lg:justify-start order-3">
              <Skeleton className="w-full max-w-sm h-48 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Products section skeleton */}
      <section className="bg-background py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StableProductLoader />
        </div>
      </section>
    </div>
  );
};