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
        // Use admin-friendly success message
        import('@/utils/adminToastMessages').then(({ showAdminToast }) => {
          showAdminToast(toast, 'orderUpdated', {
            orderId: variables.orderId,
            orderNumber: `for ${variables.newStatus}`
          });
        });
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
        
        // Use admin-friendly toast message
        import('@/utils/adminToastMessages').then(({ showAdminErrorToast }) => {
          showAdminErrorToast(toast, error, {
            orderId: variables.orderId,
            onRetry: () => updateOrderStatus(variables.orderId, variables.newStatus)
          });
        });
      } else {
        // Use admin-friendly error messages for other errors
        import('@/utils/adminToastMessages').then(({ showAdminErrorToast }) => {
          showAdminErrorToast(toast, error, {
            orderId: variables.orderId,
            onRetry: () => updateOrderStatus(variables.orderId, variables.newStatus),
            onBypassCache: () => {
              setShow409Error(variables.orderId);
            }
          });
        });
      }
    }
  });

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus, skipDebounce = false, autoBypassOn409 = true): Promise<any> => {
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
      // Enhanced error handling with automatic bypass option
      const errorMessage = error?.message || 'Unknown error occurred';
      
      // Auto-bypass on 409 errors if enabled
      if (autoBypassOn409 && (errorMessage.includes('409') || errorMessage.includes('CONCURRENT_UPDATE_IN_PROGRESS'))) {
        console.log('🔄 409 error detected, attempting automatic bypass...');
        
        try {
          const bypassResult = await bypassCacheAndUpdate(orderId, newStatus);
          console.log('✅ Automatic bypass successful');
          return bypassResult;
        } catch (bypassError) {
          console.error('❌ Automatic bypass failed, showing manual bypass option');
          setShow409Error(orderId);
          throw bypassError;
        }
      }
      
      // If this is a 409 but user is a lock holder, suggest refresh instead of retry
      if (errorMessage.includes('409') || errorMessage.includes('CONCURRENT_UPDATE_IN_PROGRESS')) {
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
      import('@/utils/adminToastMessages').then(({ showAdminToast }) => {
        showAdminToast(toast, 'cacheBypassSuccess', {
          orderId,
          orderNumber: newStatus
        });
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });

      return data;
    } catch (error: any) {
      console.error('❌ Cache bypass failed:', error);
      const errorMessage = error?.message || 'Bypass operation failed';
      
      // Use admin-friendly error message
      import('@/utils/adminToastMessages').then(({ showAdminErrorToast }) => {
        showAdminErrorToast(toast, error, {
          orderId,
          onRetry: () => bypassCacheAndUpdate(orderId, newStatus)
        });
      });
      
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