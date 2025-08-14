import React from 'react';
import { OrderSummary } from '@/components/customer/OrderSummary';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

function OrderSummaryPage() {
  const { isAuthenticated, isLoading } = useCustomerAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-6 border rounded-lg">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Order Summary
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              View your complete order history and transaction details
            </p>
          </div>

          {/* Mobile-responsive Order Summary */}
          <div className="w-full">
            <OrderSummary detailed={true} />
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default OrderSummaryPage;