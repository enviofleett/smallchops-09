import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import DashboardHeader from '@/components/DashboardHeader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { fetchDailyAnalytics } from '@/api/reports';
import { DateRangeSelector } from '@/components/dashboard/DateRangeSelector';
import { RevenuePerDayChart } from '@/components/dashboard/RevenuePerDayChart';
import { CustomerSegmentationCards } from '@/components/dashboard/CustomerSegmentationCards';
import { WeekdaySalesChart } from '@/components/dashboard/WeekdaySalesChart';
import { WeeklySalesComparison } from '@/components/dashboard/WeeklySalesComparison';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Dashboard = () => {
  const { data, isLoading, error, refresh } = useDashboardData();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);

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
        
        setLastUpdated(new Date());
        return result;
      } catch (err) {
        console.error('Failed to fetch daily metrics:', err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
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

  // Data validation warnings
  useEffect(() => {
    if (dailyMetrics?.dailyData && dailyMetrics?.summary) {
      const warnings: string[] = [];
      
      // Validate daily totals match summary
      const calculatedTotal = dailyMetrics.dailyData.reduce((sum, d) => sum + (d.orders || 0), 0);
      const reportedTotal = dailyMetrics.summary.totalOrders;
      
      if (calculatedTotal !== reportedTotal) {
        warnings.push(
          `Order count mismatch: Daily total (${calculatedTotal}) doesn't match summary (${reportedTotal})`
        );
      }
      
      // Validate guest + registered = total
      const guestTotal = dailyMetrics.dailyData.reduce((sum, d) => sum + (d.guestCheckouts || 0), 0);
      const registeredTotal = dailyMetrics.dailyData.reduce((sum, d) => sum + (d.registeredCheckouts || 0), 0);
      
      if ((guestTotal + registeredTotal) !== reportedTotal) {
        warnings.push(
          `Customer segmentation mismatch: Guest (${guestTotal}) + Registered (${registeredTotal}) ≠ Total (${reportedTotal})`
        );
      }
      
      // Check for days with missing data
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (dailyMetrics.dailyData.length < dayCount) {
        warnings.push(
          `Missing data: Expected ${dayCount} days, but only ${dailyMetrics.dailyData.length} days have data`
        );
      }
      
      setDataWarnings(warnings);
      
      if (warnings.length > 0) {
        console.error('[Dashboard] Data validation warnings:', warnings);
      }
    }
  }, [dailyMetrics, dateRange]);

  const formatLastUpdated = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return format(lastUpdated, 'HH:mm');
  };

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
      {/* Header with LIVE Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DashboardHeader />
          <Badge variant="outline" className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium">LIVE</span>
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Updated {formatLastUpdated()}</span>
          </div>
          <Button
            onClick={() => {
              refresh(true);
              refetchDaily();
            }}
            disabled={isLoading || isDailyLoading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(isLoading || isDailyLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Data Validation Warnings */}
      {dataWarnings.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Data Quality Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {dataWarnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning}</li>
              ))}
            </ul>
            <p className="text-sm mt-2">
              These warnings indicate potential data inconsistencies. Please contact support if issues persist.
            </p>
          </AlertDescription>
        </Alert>
      )}

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

      {/* Charts and Analytics */}
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
        <>
          {/* Revenue Per Day Chart with Guest/Registered Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenuePerDayChart
              dailyData={dailyMetrics?.dailyData || []}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              isLoading={isDailyLoading}
            />
            <WeekdaySalesChart
              dailyData={dailyMetrics?.dailyData || []}
              isLoading={isDailyLoading}
            />
          </div>

          {/* Weekly Sales Comparison */}
          <WeeklySalesComparison
            dailyData={dailyMetrics?.dailyData || []}
            isLoading={isDailyLoading}
          />

          {/* Customer Segmentation Cards */}
          <CustomerSegmentationCards
            {...customerSegmentation}
            isLoading={isDailyLoading}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;
