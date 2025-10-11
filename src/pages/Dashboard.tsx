import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import DashboardHeader from '@/components/DashboardHeader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { fetchDailyAnalytics } from '@/api/reports';
import { DateRangeSelector } from '@/components/dashboard/DateRangeSelector';
import { RevenuePerDayChart } from '@/components/dashboard/RevenuePerDayChart';
import { CustomerSegmentationCards } from '@/components/dashboard/CustomerSegmentationCards';
import { WeekdaySalesChart } from '@/components/dashboard/WeekdaySalesChart';
import { toast } from 'sonner';

const Dashboard = () => {
  const { data, isLoading, error, refresh } = useDashboardData();

  // Date range in YYYY-MM-DD format
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Fetch daily analytics with enhanced metrics
  const {
    data: dailyMetrics,
    isLoading: isDailyLoading,
    error: dailyError,
    refetch: refetchDaily,
  } = useQuery({
    queryKey: ['daily-analytics', dateRange],
    queryFn: async () => {
      try {
        const result = await fetchDailyAnalytics({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          retryCount: 3,
        });

        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response from analytics API');
        }
        return result;
      } catch (err) {
        console.error('Failed to fetch daily metrics:', err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!data,
  });

  // Calculate customer segmentation metrics with production-grade validation
  const customerSegmentation = useMemo(() => {
    if (!dailyMetrics?.dailyData || dailyMetrics.dailyData.length === 0) {
      console.warn('[Dashboard] No daily metrics available for customer segmentation');
      return {
        guestCount: 0,
        registeredCount: 0,
        firstTimeOrdersCount: 0,
        totalCheckouts: 0,
      };
    }

    const metrics = {
      guestCount: dailyMetrics.dailyData.reduce((sum: number, d: any) => sum + (Number(d.guestCheckouts) || 0), 0),
      registeredCount: dailyMetrics.dailyData.reduce((sum: number, d: any) => sum + (Number(d.registeredCheckouts) || 0), 0),
      firstTimeOrdersCount: dailyMetrics.dailyData.reduce((sum: number, d: any) => sum + (Number(d.firstTimeOrders) || 0), 0),
      totalCheckouts: dailyMetrics.dailyData.reduce((sum: number, d: any) => sum + (Number(d.orders) || 0), 0),
    };

    console.log('[Dashboard] Customer Segmentation Metrics:', metrics);
    console.log('[Dashboard] API Summary Stats:', dailyMetrics.summary);

    // Production validation: Ensure totals add up correctly
    const calculatedTotal = metrics.guestCount + metrics.registeredCount;
    if (calculatedTotal !== metrics.totalCheckouts) {
      console.error('[Dashboard] Metric mismatch detected!', {
        guestCount: metrics.guestCount,
        registeredCount: metrics.registeredCount,
        calculatedTotal,
        reportedTotal: metrics.totalCheckouts,
        difference: metrics.totalCheckouts - calculatedTotal
      });
    }

    // Validate against API summary
    if (dailyMetrics.summary) {
      const summaryOrders = dailyMetrics.summary.totalOrders || 0;
      if (metrics.totalCheckouts !== summaryOrders) {
        console.error('[Dashboard] Summary mismatch!', {
          calculatedFromDaily: metrics.totalCheckouts,
          summaryTotal: summaryOrders,
          difference: summaryOrders - metrics.totalCheckouts
        });
      }
    }

    return metrics;
  }, [dailyMetrics]);

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    console.log('[Dashboard] Date range changed:', { startDate, endDate });

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader />

        {/* Loading Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>

        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardHeader />
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

      {/* Date Range Selector - Full Width */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <DateRangeSelector
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onRangeChange={handleDateRangeChange}
          />
        </div>
      </div>

      {/* Revenue Per Day Chart - Full Width */}
      <div className="w-full">
        {dailyError ? (
          <div className="text-center py-12 space-y-4">
            <div className="text-destructive">
              <p className="font-medium mb-2">Failed to load analytics</p>
              <p className="text-sm text-muted-foreground mb-4">
                {dailyError instanceof Error ? dailyError.message : 'Unknown error occurred'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => refetchDaily()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <RevenuePerDayChart
            dailyData={dailyMetrics?.dailyData || []}
            isLoading={isDailyLoading}
          />
        )}
      </div>

      {/* Customer Segmentation Cards */}
      {!dailyError && (
        <CustomerSegmentationCards
          {...customerSegmentation}
          isLoading={isDailyLoading}
        />
      )}

      {/* Weekday Sales Comparison */}
      {!dailyError && (
        <WeekdaySalesChart
          dailyData={dailyMetrics?.dailyData || []}
          isLoading={isDailyLoading}
        />
      )}
    </div>
  );
};

export default Dashboard;
