import React, { useState } from 'react';
import { Package, ShoppingCart, Users, TrendingUp, RefreshCw } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import RevenueChart from '@/components/charts/RevenueChart';
import OrdersChart from '@/components/charts/OrdersChart';
import { TopCustomersChart } from '@/components/customers/TopCustomersChart';
import { DailyMetricsPanel } from '@/components/dashboard/DailyMetricsPanel';
import DashboardHeader from '@/components/DashboardHeader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressiveLoader } from '@/components/ui/progressive-loader';

import { useQuery } from '@tanstack/react-query';
import { fetchDailyAnalytics } from '@/api/reports';
import { DateRangeSelector } from '@/components/dashboard/DateRangeSelector';
import { toast } from 'sonner';


const Dashboard = () => {
  const { data, isLoading, error, refresh } = useDashboardData();
  // Date range in YYYY-MM-DD format (client local dates)
  // Backend will convert these to Lagos timezone (UTC+1) for querying
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Fetch daily analytics data with proper error handling and retry logic
  const { 
    data: dailyMetrics, 
    isLoading: isDailyLoading,
    error: dailyError,
    refetch: refetchDaily
  } = useQuery({
    queryKey: ['daily-metrics', dateRange],
    queryFn: async () => {
      try {
        const result = await fetchDailyAnalytics({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          retryCount: 3
        });
        
        // Validate response structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response from analytics API');
        }
        
        return result;
      } catch (err) {
        console.error('Failed to fetch daily metrics:', err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!data, // Only fetch daily metrics after main dashboard data loads
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        
        {/* Loading Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-sm border border-border p-4 md:p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 md:h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Loading Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-card p-4 md:p-6 rounded-xl shadow-sm border border-border">
            <Skeleton className="h-5 md:h-6 w-32 mb-4" />
            <Skeleton className="h-48 md:h-64 w-full" />
          </div>
          <div className="bg-card p-4 md:p-6 rounded-xl shadow-sm border border-border">
            <Skeleton className="h-5 md:h-6 w-32 mb-4" />
            <Skeleton className="h-48 md:h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "₦0";
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-NG').format(num);
  };

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    console.log('[Dashboard] Date range changed:', { startDate, endDate });
    
    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('[Dashboard] Invalid date format:', { startDate, endDate });
      toast.error('Invalid date format. Please select valid dates.');
      return;
    }
    
    if (start > end) {
      console.error('[Dashboard] Start date after end date:', { startDate, endDate });
      toast.error('Start date must be before end date.');
      return;
    }
    
    setDateRange({ startDate, endDate });
    toast.success('Date range updated');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardHeader />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refresh(true)}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <ProgressiveLoader
        isLoading={isLoading}
        error={error ? new Error(error) : null}
        data={data}
        skeletonType="card"
        retryFn={() => refresh(true)}
        timeout={15000}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Products"
            value={formatNumber(data?.stats?.totalProducts || 0)}
            icon={<Package />}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
          />
          <DashboardCard
            title="Total Orders"
            value={formatNumber(data?.stats?.totalOrders || 0)}
            icon={<ShoppingCart />}
            className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
          />
          <DashboardCard
            title="Total Customers"
            value={formatNumber(data?.stats?.totalCustomers || 0)}
            icon={<Users />}
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900"
          />
          <DashboardCard
            title="Total Revenue"
            value={formatCurrency(data?.stats?.totalRevenue || 0)}
            icon={<TrendingUp />}
            className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
          />
        </div>

        <TopCustomersChart 
          customers={data?.topCustomersByOrders || []} 
          type="orders"
          title="Top Customers by Orders"
        />
      </ProgressiveLoader>

      <div className="space-y-4 md:space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Daily Metrics</h3>
          <DateRangeSelector
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onRangeChange={handleDateRangeChange}
          />
        </div>

        {dailyError ? (
          <div className="text-center py-12 space-y-4">
            <div className="text-destructive">
              <p className="font-medium mb-2">Failed to load daily metrics</p>
              <p className="text-sm text-muted-foreground mb-4">
                {dailyError instanceof Error ? dailyError.message : 'Unknown error occurred'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {dailyError instanceof Error && (
                  dailyError.message.includes('session') || 
                  dailyError.message.includes('Authentication') ||
                  dailyError.message.includes('AuthSessionMissingError')
                ) ? 
                  'Your session may have expired. Please refresh the page or log in again.' : 
                dailyError instanceof Error && dailyError.message.includes('403') ?
                  'You do not have permission to view analytics. Please contact your administrator.' :
                dailyError instanceof Error && dailyError.message.includes('500') ?
                  'The server encountered an error. Please try again in a few moments.' :
                  'Please check your connection and try again.'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => refetchDaily()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                {dailyError instanceof Error && (
                  dailyError.message.includes('session') || 
                  dailyError.message.includes('Authentication')
                ) && (
                  <Button onClick={() => window.location.reload()} variant="default" size="sm">
                    Refresh Page
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <DailyMetricsPanel 
            dailyData={dailyMetrics?.dailyData || []} 
            isLoading={isDailyLoading}
          />
        )}
      </div>

      {(!data || (!data.stats?.totalProducts && !data.stats?.totalOrders)) && !isLoading && (
        <div className="text-center py-8 space-y-4">
          <div className="text-muted-foreground">
            <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No Data Available</h3>
            <p className="text-sm">Your dashboard will show data once you start adding products and receiving orders.</p>
            <p className="text-xs mt-2">Check back after your first sale!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
