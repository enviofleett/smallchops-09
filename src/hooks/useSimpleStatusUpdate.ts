import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderStatus } from '@/types/orders';

interface StatusUpdateParams {
  orderId: string;
  status: OrderStatus;
}

/**
 * Simple, lightweight order status update hook - bypasses complex pipeline
 */
export const useSimpleStatusUpdate = () => {
  const queryClient = useQueryClient();

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: StatusUpdateParams) => {
      // Direct Supabase update - no edge functions
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      const statusLabel = variables.status.replace('_', ' ');
      toast.success(`Order status updated to ${statusLabel}`);
      
      // Invalidate ALL query patterns to ensure UI updates across all tabs
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders-polling'] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['unified-orders'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-order', variables.orderId] });
      
      // Force immediate refetch of real-time orders
      queryClient.refetchQueries({ 
        queryKey: ['orders-list'],
        type: 'active'
      });
    },
    onError: (error: any) => {
      console.error('Simple status update failed:', error);
      toast.error(error.message || 'Failed to update order status');
    }
  });

  return {
    updateStatus: statusUpdateMutation.mutate,
    isUpdating: statusUpdateMutation.isPending,
    error: statusUpdateMutation.error
  };
};