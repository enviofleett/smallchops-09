import { retryWithBackoff, circuitBreakers, handleProductionError } from '@/utils/productionErrorResilience';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrder } from '@/api/orders';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validateOrderStatus, isValidOrderStatus } from '@/utils/orderValidation';

// Define enhanced error type
interface EnhancedError extends Error {
  conflictInfo?: any;
  isRetriable?: boolean;
}

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
      
      // Enhanced error handling with retry logic for production resilience
      const result = await handleProductionError(
        async () => {
          const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
            body: {
              action: 'update_status',
              orderId,
              newStatus: validatedStatus
            }
          });

          if (error) {
            throw new Error(`Network error: ${error.message}`);
          }

          if (!data?.success) {
            // Handle structured conflict responses
            const conflictInfo = data?.conflict_info || {};
            const errorMessage = data?.error || 'Status update failed';
            
            // Create enhanced error with conflict details
            const enhancedError = new Error(errorMessage) as EnhancedError;
            enhancedError.name = 'StatusUpdateError';
            enhancedError.conflictInfo = conflictInfo;
            enhancedError.isRetriable = conflictInfo.reason === 'max_retries_exceeded';
            
            throw enhancedError;
          }

          return data;
        },
        `order-status-update-${orderId}`,
        circuitBreakers.adminOrders,
        {
          maxAttempts: 3,
          baseDelay: 2000,
          timeout: 25000,
          exponentialBackoff: true
        }
      );

      return result;
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
    onError: (error: EnhancedError, variables) => {
      console.error('❌ Production status update failed:', error);
      
      // Handle enhanced error responses with conflict information
      let errorMessage = 'Failed to update order status. Please try again.';
      const conflictInfo = error.conflictInfo || {};
      
      if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('unauthorized')) {
        errorMessage = 'You are not authorized to perform this action.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Order not found. Please refresh the page.';
      } else if (conflictInfo.reason === 'max_retries_exceeded') {
        errorMessage = 'Order is being updated by another admin. Please wait and try again.';
      } else if (conflictInfo.reason === 'invalid_transition') {
        errorMessage = `Cannot change status from ${conflictInfo.current_status} to ${conflictInfo.requested_status}.`;
      } else if (conflictInfo.reason === 'no_change_needed') {
        errorMessage = 'Order status is already set to the requested value.';
      } else if (conflictInfo.reason === 'order_not_found') {
        errorMessage = 'Order not found. Please refresh the page.';
      } else if (conflictInfo.reason === 'database_error') {
        errorMessage = 'Database error occurred. Please try again.';
      }
      
      toast.error(errorMessage);
      
      // Log the enhanced error for monitoring (non-blocking)
      supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_error',
          orderId: variables.orderId,
          errorType: 'status_update_failed',
          error: {
            message: error.message,
            conflictInfo: conflictInfo,
            isRetriable: error.isRetriable || false
          }
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