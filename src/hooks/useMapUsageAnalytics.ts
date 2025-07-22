
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MapUsageAnalytics {
  totalUsage: number;
  monthlyLimit: number;
  dailyUsage: { date: string; count: number }[];
}

const fetchMapUsageAnalytics = async (): Promise<MapUsageAnalytics> => {
  const { data, error } = await supabase.functions.invoke('map-usage-analytics');
  if (error) throw new Error(`Function Error: ${error.message}`);
  return data;
};

export const useMapUsageAnalytics = () => {
  return useQuery<MapUsageAnalytics, Error>({
    queryKey: ['map-usage-analytics'],
    queryFn: fetchMapUsageAnalytics,
    refetchInterval: 300000, // Refetch every 5 minutes
  });
};
