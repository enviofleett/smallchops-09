import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RecoveryAttempt {
  orderId: string;
  attempts: number;
  lastAttempt: number;
}

/**
 * Hook to manage delivery schedule recovery with circuit breaker pattern
 * Prevents infinite loops and provides graceful degradation
 */
export const useOrderScheduleRecovery = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryAttemptsRef = useRef<Map<string, RecoveryAttempt>>(new Map());
  
  // Circuit breaker settings
  const MAX_ATTEMPTS = 3;
  const COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes
  
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
  
  const attemptScheduleRecovery = async (orderId: string): Promise<boolean> => {
    if (!canAttemptRecovery(orderId)) {
      console.warn(`🛑 Recovery circuit breaker active for order ${orderId}`);
      return false;
    }
    
    if (isRecovering) {
      console.warn('🔄 Recovery already in progress, skipping duplicate attempt');
      return false;
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
        console.log('✅ Schedule recovery successful:', data.message);
        
        // Clear successful recovery from attempts map
        recoveryAttemptsRef.current.delete(orderId);
        return true;
      } else {
        console.warn('⚠️ Schedule recovery returned false:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Schedule recovery error:', error);
      return false;
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
      lastAttempt: attempt?.lastAttempt
    };
  };
  
  const resetRecoveryState = (orderId: string) => {
    recoveryAttemptsRef.current.delete(orderId);
  };
  
  return {
    attemptScheduleRecovery,
    getRecoveryStatus,
    resetRecoveryState,
    isRecovering
  };
};