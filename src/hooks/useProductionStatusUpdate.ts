import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrder } from '@/api/orders';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Production-hardened status update hook with comprehensive error handling
 */
export const useProductionStatusUpdate = () => {
  const queryClient = useQueryClient();

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // Log admin action for audit trail
      await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_action',
          orderId,
          actionType: 'status_update',
          details: { from_status: 'unknown', to_status: status }
        }
      });

      return updateOrder(orderId, { status: status as any });
    },
    onSuccess: (data, variables) => {
      toast.success(`Order status updated to ${variables.status.replace('_', ' ')}`);
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['unified-orders'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-order', variables.orderId] });
    },
    onError: (error: any, variables) => {
      console.error('❌ Production status update failed:', error);
      
      // Enhanced error messaging
      let errorMessage = 'Failed to update order status';
      if (error?.message?.includes('authentication')) {
        errorMessage = 'Authentication expired. Please refresh and try again.';
      } else if (error?.message?.includes('edge function')) {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (error?.message?.includes('validation')) {
        errorMessage = 'Invalid status update. Please check the order details.';
      }
      
      toast.error(errorMessage);
      
      // Log error for monitoring
      supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_error',
          orderId: variables.orderId,
          errorType: 'status_update_failed',
          error: error.message
        }
      }).catch(console.warn);
    }
  });

  return {
    updateStatus: statusUpdateMutation.mutate,
    isUpdating: statusUpdateMutation.isPending,
    error: statusUpdateMutation.error
  };
};