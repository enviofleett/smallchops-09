import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitStatus {
  allowed: boolean;
  current_count: number;
  limit: number;
  burst_count: number;
  burst_limit: number;
  reset_time: string;
  burst_reset_time: string;
  user_role: string;
  reason: string;
}

export const useUploadRateLimit = () => {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkRateLimit = async () => {
    try {
      setIsChecking(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('check_upload_rate_limit', {
        body: { user_id: user.id }
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return null;
      }

      setRateLimitStatus(data);
      return data;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const formatTimeUntilReset = (resetTime: string) => {
    const now = new Date();
    const reset = new Date(resetTime);
    const diffMs = reset.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'now';
    
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    }
    
    const diffHours = Math.ceil(diffMinutes / 60);
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  };

  const getRateLimitMessage = (status: RateLimitStatus) => {
    if (status.allowed) {
      return `Upload quota: ${status.current_count}/${status.limit} used (${status.burst_count}/${status.burst_limit} in last 5 min)`;
    }
    
    if (status.reason === 'burst_limit_exceeded') {
      return `Too many uploads in quick succession. Wait ${formatTimeUntilReset(status.burst_reset_time)} to continue.`;
    }
    
    return `Upload limit reached (${status.current_count}/${status.limit}). Resets in ${formatTimeUntilReset(status.reset_time)}.`;
  };

  useEffect(() => {
    checkRateLimit();
  }, []);

  return {
    rateLimitStatus,
    isChecking,
    checkRateLimit,
    formatTimeUntilReset,
    getRateLimitMessage
  };
};