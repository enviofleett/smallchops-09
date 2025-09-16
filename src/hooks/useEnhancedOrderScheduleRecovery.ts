import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { emergencyCircuitBreaker } from '@/utils/emergencyCircuitBreaker';

interface RecoveryAttempt {
  orderId: string;
  attempts: number;
  lastAttempt: number;
}

/**
 * ENHANCED Order Schedule Recovery Hook
 * Fixes cache synchronization and infinite loop issues
 * Implements proper error handling and forced refetch
 */
export const useEnhancedOrderScheduleRecovery = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryAttemptsRef = useRef<Map<string, RecoveryAttempt>>(new Map());
  const queryClient = useQueryClient();
  
  // Circuit breaker settings
  const MAX_ATTEMPTS = 2; // Reduced from 3 to prevent loops
  const COOLDOWN_PERIOD = 10 * 60 * 1000; // 10 minutes
  
  const canAttemptRecovery = (orderId: string): boolean => {
    const attempt = recoveryAttemptsRef.current.get(orderId);
    
    if (!attempt) {
      return true;
    }
    
    const now = Date.now();
    
    // Reset attempts if cooldown period has passed
    if (now - attempt.lastAttempt > COOLDOWN_PERIOD) {
      recoveryAttemptsRef.current.delete(orderId);
      return true;
    }
    
    // Check if we've exceeded max attempts within cooldown period
    return attempt.attempts < MAX_ATTEMPTS;
  };
  
  const recordAttempt = (orderId: string) => {
    const now = Date.now();
    const existing = recoveryAttemptsRef.current.get(orderId);
    
    if (existing) {
      recoveryAttemptsRef.current.set(orderId, {
        orderId,
        attempts: existing.attempts + 1,
        lastAttempt: now
      });
    } else {
      recoveryAttemptsRef.current.set(orderId, {
        orderId,
        attempts: 1,
        lastAttempt: now
      });
    }
  };
  
  const attemptScheduleRecovery = async (orderId: string): Promise<any> => {
    console.log(`🔧 Enhanced recovery attempt for order: ${orderId}`);
    
    // Check emergency circuit breaker first
    if (!emergencyCircuitBreaker.recordAttempt(orderId)) {
      console.warn(`🛑 Emergency circuit breaker blocked recovery for order ${orderId}`);
      return { success: false, found: false, recovered: false, message: 'Circuit breaker active' };
    }

    if (!canAttemptRecovery(orderId)) {
      console.warn(`🛑 Recovery circuit breaker active for order ${orderId}`);
      return { success: false, found: false, recovered: false, message: 'Max attempts reached' };
    }

    if (isRecovering) {
      console.warn('🔄 Recovery already in progress, skipping duplicate attempt');
      return { success: false, found: false, recovered: false, message: 'Recovery in progress' };
    }

    setIsRecovering(true);
    recordAttempt(orderId);

    try {
      console.log(`🔧 Attempting schedule recovery for order: ${orderId}`);

      const { data, error } = await supabase.functions.invoke('recover-order-schedule', {
        body: { order_id: orderId }
      });

      if (error) {
        console.error('❌ Schedule recovery failed:', error);
        throw error;
      }

      if (data?.success) {
        console.log('✅ Schedule recovery response:', {
          success: data.success,
          found: data.found,
          recovered: data.recovered,
          message: data.message
        });

        // CRITICAL FIX: Force cache refresh after successful recovery
        if (data.recovered === true || (data.found !== true && data.success === true)) {
          console.log('🔄 Force refreshing order queries after successful recovery');
          
          // Invalidate all relevant queries
          await queryClient.invalidateQueries({ 
            queryKey: ['orders'] 
          });
          
          await queryClient.invalidateQueries({ 
            queryKey: ['admin-orders'] 
          });
          
          await queryClient.invalidateQueries({ 
            queryKey: ['detailed-order', orderId] 
          });
          
          await queryClient.invalidateQueries({ 
            queryKey: ['customer-delivery-schedules'] 
          });
          
          // Force refetch immediately instead of just invalidating
          await queryClient.refetchQueries({ 
            queryKey: ['orders'],
            type: 'active'
          });
          
          // Clear successful recovery from attempts map
          recoveryAttemptsRef.current.delete(orderId);
        }
        
        return {
          success: true,
          found: data.found === true,
          recovered: data.recovered === true,
          message: data.message,
          data: data.data
        };
      } else {
        console.warn('⚠️ Schedule recovery returned false:', data);
        return {
          success: false,
          found: false,
          recovered: false,
          message: data?.message || 'Recovery failed',
          error: data?.error
        };
      }
    } catch (error) {
      console.error('❌ Schedule recovery error:', error);
      return {
        success: false,
        found: false,
        recovered: false,
        message: 'Recovery failed with error',
        error: error.message
      };
    } finally {
      setIsRecovering(false);
    }
  };
  
  const getRecoveryStatus = (orderId: string) => {
    const attempt = recoveryAttemptsRef.current.get(orderId);
    return {
      canRecover: canAttemptRecovery(orderId),
      attempts: attempt?.attempts || 0,
      maxAttempts: MAX_ATTEMPTS,
      isRecovering,
      lastAttempt: attempt?.lastAttempt,
      emergencyStatus: emergencyCircuitBreaker.getStatus()
    };
  };
  
  const resetRecoveryState = (orderId: string) => {
    console.log(`🔄 Resetting recovery state for order: ${orderId}`);
    recoveryAttemptsRef.current.delete(orderId);
  };
  
  const forceRefreshOrder = async (orderId: string) => {
    console.log(`🔄 Force refreshing order data for: ${orderId}`);
    
    try {
      // Force refetch all order-related queries
      await Promise.all([
        queryClient.refetchQueries({ 
          queryKey: ['orders'],
          type: 'active'
        }),
        queryClient.refetchQueries({ 
          queryKey: ['admin-orders'],
          type: 'active' 
        }),
        queryClient.refetchQueries({ 
          queryKey: ['detailed-order', orderId],
          type: 'active'
        }),
        queryClient.refetchQueries({ 
          queryKey: ['customer-delivery-schedules'],
          type: 'active'
        })
      ]);
      
      console.log('✅ Force refresh completed');
      return { success: true };
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
      return { success: false, error: error.message };
    }
  };
  
  return {
    attemptScheduleRecovery,
    getRecoveryStatus,
    resetRecoveryState,
    forceRefreshOrder,
    isRecovering
  };
};