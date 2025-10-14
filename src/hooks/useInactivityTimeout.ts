import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes (updated from 20)
const WARNING_TIME = 2 * 60 * 1000; // 2 minutes before logout

export const useInactivityTimeout = () => {
  const { isAuthenticated, logout, userType } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    try {
      await logout();
      toast({
        title: "Session expired",
        description: "You've been logged out due to inactivity",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Auto-logout error:', error);
    }
  }, [logout, toast, clearTimers]);

  const showWarning = useCallback(() => {
    toast({
      title: "Inactivity Warning",
      description: "You'll be logged out in 2 minutes due to inactivity",
      variant: "default",
    });
  }, [toast]);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated || userType !== 'admin') return;

    lastActivityRef.current = Date.now();
    clearTimers();

    // Set warning 2 minutes before logout
    warningRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated, clearTimers, handleLogout, showWarning]);

  useEffect(() => {
    // Only enable inactivity timeout for admin users
    if (!isAuthenticated || userType !== 'admin') {
      clearTimers();
      return;
    }

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle reset calls to avoid excessive timer resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimeout) {
        resetTimer();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // Only reset once per second
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledReset);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
      clearTimers();
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isAuthenticated, userType, resetTimer, clearTimers]);

  // 🔄 AUTO SESSION REFRESH: Prevent session expiry for active admins
  useEffect(() => {
    if (!isAuthenticated || userType !== 'admin') return;

    console.log('🔄 Admin session auto-refresh enabled (every 50 minutes)');

    // Refresh session every 50 minutes to prevent 1-hour expiry
    const refreshInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('❌ Session refresh failed:', error);
          // Don't log out - just log the error for monitoring
        } else {
          console.log('✅ Admin session refreshed successfully');
        }
      } catch (err) {
        console.error('❌ Session refresh error:', err);
      }
    }, 50 * 60 * 1000); // 50 minutes

    return () => clearInterval(refreshInterval);
  }, [isAuthenticated, userType]);

  return { resetTimer };
};
