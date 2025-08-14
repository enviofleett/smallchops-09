import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { 
  getDeliveryReports, 
  calculateDailyAnalytics,
  type DeliveryReportsData 
} from '@/api/deliveryReportsApi';
import { format, subDays } from 'date-fns';

interface ReportFilters {
  startDate: string;
  endDate: string;
  period: 'today' | 'week' | 'month' | 'quarter' | 'custom';
}

export const useDeliveryReports = (filters: ReportFilters) => {
  const queryClient = useQueryClient();

  const getDateRange = () => {
    const today = new Date();
    
    switch (filters.period) {
      case 'today':
        return {
          startDate: format(today, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
      case 'week':
        return {
          startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
      case 'month':
        return {
          startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
      case 'quarter':
        return {
          startDate: format(subDays(today, 90), 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
      case 'custom':
        return {
          startDate: filters.startDate,
          endDate: filters.endDate
        };
      default:
        return {
          startDate: format(today, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd')
        };
    }
  };

  const { startDate, endDate } = getDateRange();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['delivery-reports', startDate, endDate],
    queryFn: () => getDeliveryReports(startDate, endDate),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });

  const calculateAnalyticsMutation = useMutation({
    mutationFn: calculateDailyAnalytics,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-reports'] });
      toast({
        title: "Analytics Updated",
        description: "Delivery analytics have been recalculated successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to calculate analytics:', error);
      toast({
        title: "Error",
        description: "Failed to update analytics. Please try again.",
        variant: "destructive",
      });
    },
  });

  const refreshAnalytics = (date?: string) => {
    calculateAnalyticsMutation.mutate(date);
  };

  // Calculate totals and trends
  const processedData = data ? {
    ...data,
    trends: {
      revenueGrowth: calculateGrowthRate(data.daily_analytics, 'total_delivery_fees'),
      deliveryGrowth: calculateGrowthRate(data.daily_analytics, 'total_deliveries'),
      successRateTrend: calculateGrowthRate(data.daily_analytics, 'success_rate'),
    },
    topDrivers: data.driver_performance
      .sort((a, b) => b.total_deliveries - a.total_deliveries)
      .slice(0, 5),
    topZones: data.zone_performance
      .sort((a, b) => b.total_deliveries - a.total_deliveries)
      .slice(0, 5),
  } : null;

  return {
    data: processedData,
    isLoading,
    error,
    refetch,
    refreshAnalytics,
    isRefreshing: calculateAnalyticsMutation.isPending,
  };
};

// Helper function to calculate growth rate between periods
function calculateGrowthRate(analytics: any[], field: string): number {
  if (analytics.length < 2) return 0;
  
  const sorted = analytics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
  const secondHalf = sorted.slice(Math.ceil(sorted.length / 2));
  
  const firstPeriodAvg = firstHalf.reduce((sum, item) => sum + item[field], 0) / firstHalf.length;
  const secondPeriodAvg = secondHalf.reduce((sum, item) => sum + item[field], 0) / secondHalf.length;
  
  if (firstPeriodAvg === 0) return 0;
  
  return ((secondPeriodAvg - firstPeriodAvg) / firstPeriodAvg) * 100;
}