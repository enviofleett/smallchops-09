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
      // Use SQL RPC function instead of Edge Function
      const { data, error } = await (supabase as any).rpc('get_dashboard_aggregates', {
        p_date_from: startDate.toISOString(),
        p_date_to: endDate.toISOString(),
        p_interval: interval,
        p_limit: limit,
        p_top_limit: topLimit
      });
      
      if (error) {
        console.error('RPC Error:', error);
        throw new Error(error.message);
      }
      return data as DashboardAggregatesResponse;
    },
    staleTime: 5 * 60 * 1000
  });
}
