import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Driver } from '@/api/drivers';

export const useDrivers = () => {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Driver[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useRiderAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, riderId }: { orderId: string; riderId: string | null }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          assigned_rider_id: riderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      toast.success(variables.riderId ? 'Rider assigned successfully' : 'Rider unassigned successfully');
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['real-time-order-data', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (error: any) => {
      console.error('Rider assignment failed:', error);
      toast.error('Failed to update rider assignment');
    }
  });
};