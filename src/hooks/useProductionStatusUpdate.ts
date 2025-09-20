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
      
      // PRODUCTION FIX: Enhanced error handling with automatic retry for specific errors
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
            // Enhanced error classification for better user experience
            const errorMsg = response.error.message || 'Failed to update order status';
            
            if (errorMsg.includes('CONCURRENT_UPDATE_IN_PROGRESS')) {
              throw new Error('CONCURRENT_UPDATE_IN_PROGRESS: Another admin is updating this order');
            } else if (errorMsg.includes('INVALID_STATUS_TRANSITION')) {
              throw new Error('INVALID_STATUS_TRANSITION: Invalid status change for current order state');
            } else if (errorMsg.includes('DATABASE_ERROR')) {
              throw new Error('DATABASE_ERROR: Server error occurred');
            }
            
            throw new Error(errorMsg);
          }

          if (!response.data?.success) {
            const errorMsg = response.data?.error || 'Status update failed';
            
            // Handle specific error codes from edge function
            if (response.data?.errorCode === 'CONCURRENT_UPDATE_IN_PROGRESS') {
              throw new Error('CONCURRENT_UPDATE_IN_PROGRESS: Another admin is updating this order');
            } else if (response.data?.errorCode === 'INVALID_STATUS_TRANSITION') {
              throw new Error('INVALID_STATUS_TRANSITION: Invalid status change');
            }
            
            throw new Error(errorMsg);
          }

          return response.data.order || response.data;
        },
        `order-status-update-${orderId}`,
        circuitBreakers.adminOrders,
        {
          maxAttempts: 3,
          baseDelay: 2000,
          timeout: 25000, // Increased timeout for database operations
          exponentialBackoff: true
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
      
      // PRODUCTION FIX: Enhanced error classification and user messaging
      let errorMessage = 'Failed to update order status';
      const errorMsg = error?.message || '';
      
      if (errorMsg.includes('CONCURRENT_UPDATE_IN_PROGRESS') || errorMsg.includes('Order is currently being modified')) {
        errorMessage = 'Another admin is updating this order. Please wait and try again in a moment.';
      } else if (errorMsg.includes('Rate limit exceeded')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (errorMsg.includes('authentication') || errorMsg.includes('unauthorized')) {
        errorMessage = 'Authentication expired. Please refresh and try again.';
      } else if (errorMsg.includes('INVALID_STATUS_TRANSITION') || errorMsg.includes('Invalid status')) {
        errorMessage = 'Invalid status transition. Please refresh the page and check current order status.';
      } else if (errorMsg.includes('DATABASE_ERROR') || errorMsg.includes('edge function') || errorMsg.includes('non-2xx status')) {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
      } else if (errorMsg.includes('validation') || errorMsg.includes('invalid input value for enum')) {
        errorMessage = 'Invalid status update. Please refresh the page and try again.';
      } else if (errorMsg.includes('Invalid order status:')) {
        errorMessage = errorMsg; // Use the specific validation message
      } else if (errorMsg.includes('duplicate key value violates unique constraint')) {
        errorMessage = 'Status update conflict detected. Retrying automatically...';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
        errorMessage = 'Request timed out. Please try again.';
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