import { useEffect, useRef, useCallback } from 'react';

interface UsePaymentTimeoutProps {
  timeoutMs?: number;
  onTimeout: () => void;
  isActive: boolean;
}

export const usePaymentTimeout = ({ 
  timeoutMs = 300000, // 5 minutes default
  onTimeout,
  isActive 
}: UsePaymentTimeoutProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (isActive) {
      timeoutRef.current = setTimeout(() => {
        console.log('⏰ Payment timeout reached');
        onTimeout();
      }, timeoutMs);
    }
  }, [timeoutMs, onTimeout, isActive]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    startTimer();
  }, [clearTimer, startTimer]);

  useEffect(() => {
    if (isActive) {
      startTimer();
    } else {
      clearTimer();
    }

    return () => clearTimer();
  }, [isActive, startTimer, clearTimer]);

  return { resetTimer, clearTimer };
};