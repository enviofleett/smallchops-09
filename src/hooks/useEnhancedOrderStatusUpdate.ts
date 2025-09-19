import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderStatus } from '@/types/orders';

interface IdempotentUpdateRequest {
  orderId: string;
  newStatus: OrderStatus;
  idempotencyKey: string;
  sessionId: string;
}

export const useEnhancedOrderStatusUpdate = () => {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random()}`);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Promise<any>>>(new Map());
  const [lastUpdateTimes, setLastUpdateTimes] = useState<Map<string, number>>(new Map());
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, idempotencyKey }: IdempotentUpdateRequest) => {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'update',
          orderId,
          updates: { status: newStatus },
          admin_session_id: sessionId,
          idempotency_key: idempotencyKey
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Update failed');
      
      return data;
    },
    onSuccess: (data, variables) => {
      // Remove from pending updates
      setPendingUpdates(prev => {
        const next = new Map(prev);
        next.delete(variables.orderId);
        return next;
      });

      // Update last update time
      setLastUpdateTimes(prev => {
        const next = new Map(prev);
        next.set(variables.orderId, Date.now());
        return next;
      });

      // Show success message
      if (data.cached) {
        toast.success('Status update (cached result)');
      } else {
        toast.success(`Order status updated to ${variables.newStatus}`);
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
    },
    onError: (error: any, variables) => {
      // Remove from pending updates
      setPendingUpdates(prev => {
        const next = new Map(prev);
        next.delete(variables.orderId);
        return next;
      });

      console.error('❌ Enhanced order status update failed:', error);
      
      // Enhanced error handling with specific messages for different error types
      const errorMessage = error?.message || 'Unknown error occurred';
      
      if (errorMessage.includes('CONCURRENT_UPDATE_IN_PROGRESS') || errorMessage.includes('Another admin session is currently updating') || errorMessage.includes('409')) {
        toast.error('Another admin is currently updating this order. Please wait and try again.');
      } else if (errorMessage.includes('ORDER_MODIFIED_CONCURRENTLY')) {
        toast.error('Order was modified by another user. Please refresh and try again.');
      } else if (errorMessage.includes('rate limit')) {
        toast.error('Too many requests. Please wait before trying again.');
      } else if (errorMessage.includes('timeout')) {
        toast.error('Request timed out. Please check your connection and try again.');
      } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        toast.error('Session expired. Please refresh the page and log in again.');
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Failed to update order status: ${errorMessage}`);
      }
    }
  });

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus): Promise<any> => {
    const now = Date.now();
    const lastUpdate = lastUpdateTimes.get(orderId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    // Enhanced debouncing: Prevent updates within 2 seconds
    if (timeSinceLastUpdate < 2000) {
      const remainingTime = 2000 - timeSinceLastUpdate;
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    // Check if there's already a pending update for this order
    if (pendingUpdates.has(orderId)) {
      console.log('🔄 Returning existing pending update for order:', orderId);
      return pendingUpdates.get(orderId);
    }

    // Generate client-side idempotency key
    const idempotencyKey = `${sessionId}_${orderId}_${newStatus}_${now}`;

    const updatePromise = updateMutation.mutateAsync({
      orderId,
      newStatus,
      idempotencyKey,
      sessionId
    });

    // Track pending update
    setPendingUpdates(prev => {
      const next = new Map(prev);
      next.set(orderId, updatePromise);
      return next;
    });

    try {
      const result = await updatePromise;
      return result;
    } catch (error) {
      // The error is already handled in onError, just re-throw for caller
      throw error;
    }
  }, [updateMutation, sessionId, pendingUpdates, lastUpdateTimes]);

  return {
    updateOrderStatus,
    isUpdating: updateMutation.isPending,
    error: updateMutation.error,
    sessionId,
    isPending: (orderId: string) => pendingUpdates.has(orderId),
    getTimeSinceLastUpdate: (orderId: string) => {
      const lastUpdate = lastUpdateTimes.get(orderId);
      return lastUpdate ? Date.now() - lastUpdate : Infinity;
    }
  };
};