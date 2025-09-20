import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderStatus } from '@/types/orders';

interface IdempotentUpdateRequest {
  orderId: string;
  newStatus: OrderStatus;
  idempotencyKey: string;
  adminUserId: string;
}

export const useEnhancedOrderStatusUpdate = () => {
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Promise<any>>>(new Map());
  const [lastUpdateTimes, setLastUpdateTimes] = useState<Map<string, number>>(new Map());
  const [show409Error, setShow409Error] = useState<string | null>(null);
  const [isBypassing, setIsBypassing] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Get current admin user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        setAdminUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const updateMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, idempotencyKey, adminUserId }: IdempotentUpdateRequest) => {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'update',
          orderId,
          updates: { status: newStatus },
          admin_user_id: adminUserId,
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
        // Set 409 error state to show bypass button
        setShow409Error(variables.orderId);
        
        // Check if this admin might be a lock holder experiencing a false positive
        const getTimeSinceLastUpdate = (orderId: string) => {
          const lastUpdate = lastUpdateTimes.get(orderId);
          return lastUpdate ? Date.now() - lastUpdate : Infinity;
        };
        const timeSinceLastUpdate = getTimeSinceLastUpdate(variables.orderId);
        if (timeSinceLastUpdate < 35000) { // Active within 35 seconds (lock duration + buffer)
          toast.error('Cache conflict detected. Use the "Bypass Cache" button to force the update.');
        } else {
          toast.error('Another admin is updating this order or cache is stuck. Use "Bypass Cache" to force update.');
        }
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

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus, skipDebounce = false): Promise<any> => {
    if (!adminUserId) {
      throw new Error('Admin user not authenticated');
    }

    const now = Date.now();
    const lastUpdate = lastUpdateTimes.get(orderId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    // Enhanced debouncing: Skip timing restrictions if specified (for lock holders)
    if (!skipDebounce && timeSinceLastUpdate < 2000) {
      const remainingTime = 2000 - timeSinceLastUpdate;
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    // Check if there's already a pending update for this order
    if (pendingUpdates.has(orderId)) {
      console.log('🔄 Returning existing pending update for order:', orderId);
      return pendingUpdates.get(orderId);
    }

    // Generate client-side idempotency key with enhanced collision resistance
    const entropy = Math.random().toString(36).substring(2, 8);
    const idempotencyKey = `${adminUserId}_${orderId}_${newStatus}_${now}_${entropy}`;

    const updatePromise = updateMutation.mutateAsync({
      orderId,
      newStatus,
      idempotencyKey,
      adminUserId
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
      // Enhanced error handling for lock holders
      const errorMessage = error?.message || 'Unknown error occurred';
      
      // If this is a 409 but user is a lock holder, suggest refresh instead of retry
      if (errorMessage.includes('409') || errorMessage.includes('CONCURRENT_UPDATE_IN_PROGRESS')) {
        // Check if user might be lock holder and suggest different action
        const getTimeSinceLastUpdate = (orderId: string) => {
          const lastUpdate = lastUpdateTimes.get(orderId);
          return lastUpdate ? Date.now() - lastUpdate : Infinity;
        };
        const isLikelyLockHolder = getTimeSinceLastUpdate(orderId) < 30000; // Active within 30 seconds
        if (isLikelyLockHolder) {
          console.log('🔒 Potential lock holder experiencing 409 - suggesting refresh');
          throw new Error('Your session may have expired. Please refresh the page and try again.');
        }
      }
      
      // The error is already handled in onError, just re-throw for caller
      throw error;
    }
  }, [updateMutation, adminUserId, pendingUpdates, lastUpdateTimes]);

  // Bypass cache and update function
  const bypassCacheAndUpdate = useCallback(async (orderId: string, newStatus: OrderStatus): Promise<any> => {
    if (!adminUserId) {
      throw new Error('Admin user not authenticated');
    }

    setIsBypassing(true);
    setShow409Error(null); // Clear the error state

    try {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'bypass_and_update',
          orderId,
          updates: { status: newStatus },
          admin_user_id: adminUserId
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Bypass failed');

      // Show success message
      toast.success(`✅ Cache bypassed! Order status updated to ${newStatus}`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });

      return data;
    } catch (error: any) {
      console.error('❌ Cache bypass failed:', error);
      const errorMessage = error?.message || 'Bypass operation failed';
      toast.error(`Failed to bypass cache: ${errorMessage}`);
      throw error;
    } finally {
      setIsBypassing(false);
    }
  }, [adminUserId, queryClient]);

  return {
    updateOrderStatus,
    bypassCacheAndUpdate,
    isUpdating: updateMutation.isPending,
    isBypassing,
    error: updateMutation.error,
    adminUserId,
    show409Error,
    clearBypassError: () => setShow409Error(null),
    isPending: (orderId: string) => pendingUpdates.has(orderId),
    getTimeSinceLastUpdate: (orderId: string) => {
      const lastUpdate = lastUpdateTimes.get(orderId);
      return lastUpdate ? Date.now() - lastUpdate : Infinity;
    }
  };
};