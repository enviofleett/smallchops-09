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

  // Enhanced lock holder detection with real-time status checking
  const checkLockStatus = useCallback(async (orderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'check_lock_status',
          orderId,
          admin_user_id: adminUserId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Lock status check failed:', error);
      return { is_locked: false, is_lock_holder: false };
    }
  }, [adminUserId]);

  // Proactive cache cleanup for problematic transitions
  const proactiveCleanup = useCallback(async (orderId: string, reason: string) => {
    try {
      console.log(`🧹 Proactive cleanup for order ${orderId}, reason: ${reason}`);
      
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'proactive_cleanup',
          orderId,
          reason,
          admin_user_id: adminUserId
        }
      });

      if (error) throw error;
      console.log('✅ Proactive cleanup completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Proactive cleanup failed:', error);
      return { success: false };
    }
  }, [adminUserId]);

  // Enhanced stuck state detection
  const detectStuckState = useCallback(async (orderId: string): Promise<boolean> => {
    const lastUpdate = lastUpdateTimes.get(orderId);
    const timeSinceLastUpdate = lastUpdate ? Date.now() - lastUpdate : Infinity;
    
    // Consider stuck if:
    // 1. Has pending update for more than 30 seconds
    // 2. Last update was more than 2 minutes ago and still in processing state
    const hasPendingTooLong = pendingUpdates.has(orderId) && timeSinceLastUpdate > 30000;
    const staleProcessing = timeSinceLastUpdate > 120000;
    
    if (hasPendingTooLong || staleProcessing) {
      console.log(`🚨 Stuck state detected for order ${orderId}:`, {
        hasPendingTooLong,
        staleProcessing,
        timeSinceLastUpdate
      });
      
      // Proactive cleanup for stuck states
      await proactiveCleanup(orderId, `stuck_state_detection_${hasPendingTooLong ? 'pending' : 'stale'}`);
      return true;
    }
    
    return false;
  }, [pendingUpdates, lastUpdateTimes, proactiveCleanup]);

  // Bypass cache and update function (moved here to fix dependency order)
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

  // Smart cache bypass with lock holder detection
  const smartCacheBypass = useCallback(async (orderId: string, newStatus: OrderStatus): Promise<any> => {
    console.log('🧠 Smart cache bypass initiated for order:', orderId);
    
    // Check current lock status
    const lockStatus = await checkLockStatus(orderId);
    
    if (lockStatus.is_lock_holder) {
      console.log('🔓 Current user is lock holder, performing direct bypass');
      return bypassCacheAndUpdate(orderId, newStatus);
    }
    
    if (lockStatus.is_locked && !lockStatus.is_lock_holder) {
      console.log('🔒 Order locked by another admin, cannot bypass');
      throw new Error('Order is currently being updated by another admin. Please wait and try again.');
    }
    
    // Not locked, perform bypass with acquisition
    console.log('🆓 Order not locked, performing bypass with lock acquisition');
    return bypassCacheAndUpdate(orderId, newStatus);
  }, [checkLockStatus, bypassCacheAndUpdate]);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus, skipDebounce = false, autoBypassOn409 = true): Promise<any> => {
    if (!adminUserId) {
      throw new Error('Admin user not authenticated');
    }

    const now = Date.now();
    const lastUpdate = lastUpdateTimes.get(orderId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    // Enhanced debouncing with grace period for lock acquisition timing
    const gracePeriod = 5000; // 5 second grace period for lock holders
    const standardDebounce = 2000;
    
    const isRecentLockHolder = timeSinceLastUpdate < gracePeriod;
    const debounceTime = isRecentLockHolder ? 500 : standardDebounce; // Reduced debounce for recent lock holders

    if (!skipDebounce && timeSinceLastUpdate < debounceTime) {
      const remainingTime = debounceTime - timeSinceLastUpdate;
      console.log(`⏳ Debouncing for ${remainingTime}ms (${isRecentLockHolder ? 'lock holder' : 'standard'})`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    // Enhanced stuck state detection before proceeding
    const isStuck = await detectStuckState(orderId);
    if (isStuck) {
      console.log('🚨 Stuck state detected, clearing pending updates');
      setPendingUpdates(prev => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
    }

    // Check if there's already a pending update for this order (with enhanced logic)
    if (pendingUpdates.has(orderId) && !isStuck) {
      console.log('🔄 Returning existing pending update for order:', orderId);
      return pendingUpdates.get(orderId);
    }

    // CRITICAL FIX: Generate deterministic idempotency key WITHOUT timestamp for true idempotency
    const idempotencyKey = `${adminUserId}_${orderId}_${newStatus}`;

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
      // Enhanced error handling with smart bypass logic
      const errorMessage = error?.message || 'Unknown error occurred';
      
      // Smart auto-bypass on 409 errors if enabled
      if (autoBypassOn409 && (errorMessage.includes('409') || errorMessage.includes('CONCURRENT_UPDATE_IN_PROGRESS'))) {
        console.log('🔄 409 error detected, attempting smart bypass...');
        
        try {
          const bypassResult = await smartCacheBypass(orderId, newStatus);
          console.log('✅ Smart bypass successful');
          return bypassResult;
        } catch (bypassError) {
          console.error('❌ Smart bypass failed, showing manual bypass option');
          setShow409Error(orderId);
          throw bypassError;
        }
      }
      
      // Enhanced lock holder detection with real-time checking
      if (errorMessage.includes('409') || errorMessage.includes('CONCURRENT_UPDATE_IN_PROGRESS')) {
        const lockStatus = await checkLockStatus(orderId);
        
        if (lockStatus.is_lock_holder) {
          console.log('🔒 Confirmed lock holder experiencing 409 - performing automatic bypass');
          try {
            const result = await smartCacheBypass(orderId, newStatus);
            return result;
          } catch (bypassError) {
            console.error('❌ Lock holder bypass failed');
            throw new Error('Your session may have expired. Please refresh the page and try again.');
          }
        } else if (lockStatus.is_locked) {
          throw new Error('Another admin is currently updating this order. Please wait a moment and try again.');
        }
      }
      
      // The error is already handled in onError, just re-throw for caller
      throw error;
    }
  }, [updateMutation, adminUserId, pendingUpdates, lastUpdateTimes, detectStuckState, smartCacheBypass, checkLockStatus]);

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
    },
    // Phase 2 enhancements
    checkLockStatus,
    proactiveCleanup,
    detectStuckState,
    smartCacheBypass
  };
};