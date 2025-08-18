import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DeliverySchedule {
  id: string;
  order_id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  requested_at: string;
  is_flexible: boolean;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export const useCustomerOrderSchedules = (orderIds: string[]) => {
  const { data: schedules = {}, isLoading, error } = useQuery({
    queryKey: ['customer-delivery-schedules', orderIds],
    queryFn: async () => {
      if (!orderIds.length) return {};
      
      const { data, error } = await supabase
        .from('order_delivery_schedule')
        .select('*')
        .in('order_id', orderIds);
      
      if (error) throw error;
      
      // Convert array to object keyed by order_id
      const schedulesMap: Record<string, DeliverySchedule> = {};
      data?.forEach(schedule => {
        schedulesMap[schedule.order_id] = schedule;
      });
      
      return schedulesMap;
    },
    enabled: orderIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    schedules,
    loading: isLoading,
    error
  };
};