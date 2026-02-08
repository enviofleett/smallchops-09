import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardAggregatesResponse } from '@/types/dashboard';

export function useDashboardAggregates(
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day',
  limit: number = 2000,
  topLimit: number = 5
) {
  return useQuery({
    queryKey: ['dashboard-aggregates', startDate.toISOString(), endDate.toISOString(), interval, limit, topLimit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('dashboard-aggregates', {
        body: {
          dateFrom: startDate.toISOString(),
          dateTo: endDate.toISOString(),
          interval,
          limit,
          topLimit
        }
      });
      if (error) {
        throw new Error(error.message);
      }
      return data as DashboardAggregatesResponse;
    },
    staleTime: 5 * 60 * 1000
  });
}
