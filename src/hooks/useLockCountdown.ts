import { useState, useEffect } from 'react';

interface UseLockCountdownProps {
  expiresAt?: string;
  isLocked: boolean;
  refreshInterval?: number; // in milliseconds
}

interface LockCountdownResult {
  timeRemaining: number; // in seconds
  isExpired: boolean;
  percentageRemaining: number;
}

export const useLockCountdown = ({
  expiresAt,
  isLocked,
  refreshInterval = 1000
}: UseLockCountdownProps): LockCountdownResult => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!isLocked || !expiresAt) {
      setTimeRemaining(0);
      setIsExpired(!isLocked);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      
      setTimeRemaining(remaining);
      setIsExpired(remaining <= 0);
    };

    // Initial calculation
    updateCountdown();

    // Set up interval for updates
    const interval = setInterval(updateCountdown, refreshInterval);

    return () => clearInterval(interval);
  }, [expiresAt, isLocked, refreshInterval]);

  // Calculate percentage remaining (assuming 30 second default lock duration)
  const totalLockDuration = 30; // seconds
  const percentageRemaining = Math.max(0, Math.min(100, (timeRemaining / totalLockDuration) * 100));

  return {
    timeRemaining,
    isExpired,
    percentageRemaining
  };
};