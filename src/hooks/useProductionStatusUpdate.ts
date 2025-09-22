import { retryWithBackoff, circuitBreakers, handleProductionError } from '@/utils/productionErrorResilience';
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
      
      // Use production-grade error handling with circuit breaker
      return await handleProductionError(
        async () => {
          const response = await supabase.functions.invoke('admin-orders-manager', {
            body: {
              action: 'update',
              orderId,
              updates: { status: validatedStatus }
            }
          });

          if (response.error) {
            throw new Error(response.error.message || 'Failed to update order status');
          }

          if (!response.data?.success) {
            throw new Error(response.data?.error || 'Status update failed');
          }

          return response.data.order || response.data;
        },
        `order-status-update-${orderId}`,
        circuitBreakers.adminOrders,
        {
          maxAttempts: 2,
          baseDelay: 1500,
          timeout: 15000
        }
      );
    },
    onSuccess: (data, variables) => {
      const statusLabel = variables.status.replace('_', ' ');
      toast.success(`✅ Order status updated to ${statusLabel}`);
      
      // Log bulletproof success metrics
      if (data?.email_queued?.success) {
        console.log('📧 Email notification queued successfully');
      }
      
      if (data?.email_queued?.deduplicated) {
        console.log('🔄 Email notification deduplicated (already queued)');
      }
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['unified-orders'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-order', variables.orderId] });
    },
    onError: (error: any, variables) => {
      console.error('❌ Production status update failed:', error);
      
      // BULLETPROOF: Enhanced error messaging with specific error detection
      let errorMessage = 'Failed to update order status';
      const errorMsg = error?.message || '';
      
      if (errorMsg.includes('Rate limit exceeded')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (errorMsg.includes('Order is currently being modified by another admin')) {
        errorMessage = 'Order is being updated by another admin. Please try again in a moment.';
      } else if (errorMsg.includes('authentication') || errorMsg.includes('unauthorized')) {
        errorMessage = 'Authentication expired. Please refresh and try again.';
      } else if (errorMsg.includes('edge function') || errorMsg.includes('non-2xx status')) {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (errorMsg.includes('validation') || errorMsg.includes('invalid input value for enum')) {
        errorMessage = 'Invalid status update. Please refresh the page and try again.';
      } else if (errorMsg.includes('Invalid status:') || errorMsg.includes('Invalid order status:')) {
        errorMessage = errorMsg; // Use the specific validation message
      } else if (errorMsg.includes('duplicate key value violates unique constraint')) {
        errorMessage = 'Update in progress by another session. Please try again.';
      } else if (errorMsg && errorMsg !== 'Failed to update order status') {
        errorMessage = errorMsg; // Use the actual error message if it's meaningful
      }
      
      toast.error(errorMessage);
      
      // Log error for monitoring (non-blocking)
      supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_error',
          orderId: variables.orderId,
          errorType: 'status_update_failed',
          error: error.message
        }
      }).catch(() => {
        // Silently fail - error logging shouldn't block user workflow
      });
    }
  });

  return {
    updateStatus: statusUpdateMutation.mutate,
    isUpdating: statusUpdateMutation.isPending,
    error: statusUpdateMutation.error
  };
};