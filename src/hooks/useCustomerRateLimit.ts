import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitStatus {
  isAllowed: boolean;
  remainingActions: number;
  resetTime: Date | null;
  error?: string;
}

export const useCustomerRateLimit = (operation: string = 'create', limit: number = 50) => {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    isAllowed: true,
    remainingActions: limit,
    resetTime: null
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkRateLimit = async () => {
    setIsChecking(true);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setRateLimitStatus({
          isAllowed: false,
          remainingActions: 0,
          resetTime: null,
          error: 'User not authenticated'
        });
        return false;
      }

      const { data: isAllowed, error } = await supabase.rpc('check_customer_operation_rate_limit', {
        p_admin_id: user.user.id,
        p_operation: operation,
        p_limit: limit
      });

      if (error) {
        console.error('Rate limit check error:', error);
        setRateLimitStatus({
          isAllowed: true, // Allow by default if check fails
          remainingActions: limit,
          resetTime: null,
          error: 'Failed to check rate limit'
        });
        return true;
      }

      // Calculate remaining actions by checking audit logs
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentActions, error: countError } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('user_id', user.user.id)
        .like('action', `%customer%`)
        .like('action', `%${operation}%`)
        .gte('event_time', oneHourAgo);

      const usedActions = recentActions?.length || 0;
      const remaining = Math.max(0, limit - usedActions);
      const resetTime = new Date(Date.now() + 60 * 60 * 1000); // Next hour

      setRateLimitStatus({
        isAllowed: isAllowed as boolean,
        remainingActions: remaining,
        resetTime,
        error: countError ? 'Failed to get action count' : undefined
      });

      return isAllowed as boolean;

    } catch (error) {
      console.error('Rate limit check failed:', error);
      setRateLimitStatus({
        isAllowed: true, // Allow by default on error
        remainingActions: limit,
        resetTime: null,
        error: 'Rate limit check failed'
      });
      return true;
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkRateLimit();
  }, [operation, limit]);

  return {
    ...rateLimitStatus,
    isChecking,
    checkRateLimit,
    formatResetTime: () => {
      if (!rateLimitStatus.resetTime) return 'Unknown';
      return rateLimitStatus.resetTime.toLocaleTimeString();
    }
  };
};