import React, { memo, useCallback, useMemo } from 'react';
import { Package, ShoppingCart, Users, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import { TopCustomersChart } from '@/components/customers/TopCustomersChart';
import { TopSellingProducts } from '@/components/admin/TopSellingProducts';
import { FulfillmentStatistics } from '@/components/admin/FulfillmentStatistics';
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Types for better type safety
interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
}

interface FulfillmentStats {
  delivery_orders: number;
  pickup_orders: number;
  delivery_percentage: number;
  pickup_percentage: number;
  total_fulfillment_orders: number;
}

interface DashboardData {
  stats: DashboardStats;
  topProducts: any[];
  topCustomers: any[];
  fulfillmentStats: FulfillmentStats;
}

// Memoized skeleton loader component
const DashboardSkeleton = memo(() => (
  <div className="bg-card rounded-2xl shadow-sm border border-border p-4 md:p-6">
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-6 md:h-8 w-16 mb-2" />
    <Skeleton className="h-3 w-20" />
  </div>
));

DashboardSkeleton.displayName = 'DashboardSkeleton';

// Memoized empty state component
const EmptyState = memo(() => (
  <div className="text-center py-12 space-y-6 bg-card rounded-2xl border border-border">
    <div className="text-muted-foreground">
      <div className="mx-auto h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
        <Package className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">No Data Available</h3>
      <p className="text-sm max-w-sm mx-auto leading-relaxed">
        Your dashboard will populate with insights once you start adding products and receiving orders.
      </p>
    </div>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Memoized error component
const ErrorState = memo(({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) => (
  <div className="container mx-auto p-6">
    <Alert variant="destructive" className="max-w-2xl mx-auto">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <span>Failed to load dashboard data. Please check your connection and try again.</span>
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-background"
        >
          <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  </div>
));

ErrorState.displayName = 'ErrorState';

export const AdminDashboard: React.FC = () => {
  const { data, isLoading, error, refetch, isRefetching } = useAdminDashboardData();

  // Memoized formatting functions to prevent unnecessary re-renders
  const formatCurrency = useCallback((amount: number): string => {
    if (!amount || amount === 0) return "₦0";
    
    try {
      return new Intl.NumberFormat('en-NG', { 
        style: 'currency', 
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `₦${amount.toLocaleString()}`;
    }
  }, []);

  const formatNumber = useCallback((num: number): string => {
    if (!num || num === 0) return "0";
    
    try {
      return new Intl.NumberFormat('en-NG').format(num);
    } catch (error) {
      console.error('Number formatting error:', error);
      return num.toString();
    }
  }, []);

  // Memoized refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [refetch]);

  // Memoized dashboard cards data
  const dashboardCards = useMemo(() => {
    if (!data?.stats) return [];

    return [
      {
        title: "Total Products",
        value: formatNumber(data.stats.totalProducts || 0),
        icon: <Package className="h-5 w-5" />,
        className: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800",
        trend: data.stats.totalProducts > 0 ? 'positive' : 'neutral'
      },
      {
        title: "Total Orders",
        value: formatNumber(data.stats.totalOrders || 0),
        icon: <ShoppingCart className="h-5 w-5" />,
        className: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800",
        trend: data.stats.totalOrders > 0 ? 'positive' : 'neutral'
      },
      {
        title: "Total Customers",
        value: formatNumber(data.stats.totalCustomers || 0),
        icon: <Users className="h-5 w-5" />,
        className: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800",
        trend: data.stats.totalCustomers > 0 ? 'positive' : 'neutral'
      },
      {
        title: "Total Revenue",
        value: formatCurrency(data.stats.totalRevenue || 0),
        icon: <TrendingUp className="h-5 w-5" />,
        className: "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800",
        trend: data.stats.totalRevenue > 0 ? 'positive' : 'neutral'
      }
    ];
  }, [data?.stats, formatNumber, formatCurrency]);

  // Memoized check for empty data
  const hasData = useMemo(() => {
    return data?.stats && (
      data.stats.totalProducts > 0 || 
      data.stats.totalOrders > 0 || 
      data.stats.totalCustomers > 0
    );
  }, [data?.stats]);

  // Default fulfillment stats with proper typing
  const defaultFulfillmentStats: FulfillmentStats = useMemo(() => ({
    delivery_orders: 0,
    pickup_orders: 0,
    delivery_percentage: 0,
    pickup_percentage: 0,
    total_fulfillment_orders: 0
  }), []);

  // Handle error state
  if (error) {
    return <ErrorState onRetry={handleRefresh} isRetrying={isRefetching} />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 min-h-screen">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Business insights and key metrics
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading || isRefetching}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 min-w-[100px] transition-all hover:shadow-md"
        >
          <RefreshCw className={cn(
            "h-4 w-4 transition-transform",
            (isLoading || isRefetching) && "animate-spin"
          )} />
          {(isLoading || isRefetching) ? 'Loading...' : 'Refresh'}
        </Button>
      </header>

      {/* Key Metrics Section */}
      <section aria-label="Key Metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }, (_, i) => (
              <DashboardSkeleton key={`skeleton-${i}`} />
            ))
          ) : (
            dashboardCards.map((card, index) => (
              <DashboardCard
                key={`${card.title}-${index}`}
                title={card.title}
                value={card.value}
                icon={card.icon}
                className={card.className}
              />
            ))
          )}
        </div>
      </section>

      {/* Charts and Analytics Section */}
      {(hasData || isLoading) && (
        <section aria-label="Analytics" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Top Selling Products</h2>
              <TopSellingProducts 
                products={data?.topProducts || []} 
                isLoading={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Fulfillment Statistics</h2>
              <FulfillmentStatistics 
                stats={data?.fulfillmentStats || defaultFulfillmentStats}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Top Customers */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Customer Analytics</h2>
            <TopCustomersChart 
              customers={data?.topCustomers || []} 
              type="orders"
              title="Top Customers by Orders"
            />
          </div>
        </section>
      )}

      {/* Empty State */}
      {!hasData && !isLoading && <EmptyState />}
    </div>
  );
};

// Add display name for debugging
AdminDashboard.displayName = 'AdminDashboard';

export default memo(AdminDashboard);
