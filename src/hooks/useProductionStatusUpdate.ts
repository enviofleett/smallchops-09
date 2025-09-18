import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrder } from '@/api/orders';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validateOrderStatus, isValidOrderStatus } from '@/utils/orderValidation';

/**
 * Production-hardened status update hook with comprehensive error handling
 */
export const useProductionStatusUpdate = () => {
  const queryClient = useQueryClient();

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // CRITICAL: Validate status before sending to server
      if (!isValidOrderStatus(status)) {
        throw new Error(`Invalid order status: "${status}". Please refresh the page and try again.`);
      }

      const validatedStatus = validateOrderStatus(status);
      
      // Log admin action for audit trail
      await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_action',
          orderId,
          actionType: 'status_update',
          details: { from_status: 'unknown', to_status: validatedStatus }
        }
      });

      return updateOrder(orderId, { status: validatedStatus });
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
      
      // Enhanced error messaging with specific error detection
      let errorMessage = 'Failed to update order status';
      const errorMsg = error?.message || '';
      
      if (errorMsg.includes('authentication') || errorMsg.includes('unauthorized')) {
        errorMessage = 'Authentication expired. Please refresh and try again.';
      } else if (errorMsg.includes('edge function') || errorMsg.includes('non-2xx status')) {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (errorMsg.includes('validation') || errorMsg.includes('invalid input value for enum')) {
        errorMessage = 'Invalid status update. Please refresh the page and try again.';
      } else if (errorMsg.includes('Invalid status:') || errorMsg.includes('Invalid order status:')) {
        errorMessage = errorMsg; // Use the specific validation message
      } else if (errorMsg && errorMsg !== 'Failed to update order status') {
        errorMessage = errorMsg; // Use the actual error message if it's meaningful
      }
      
      toast.error(errorMessage);
      
      // Log error for monitoring with enhanced context
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