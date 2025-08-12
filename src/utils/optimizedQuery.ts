// Optimized query configuration to reduce Supabase usage
export const OPTIMIZED_QUERY_CONFIG = {
  // Increased cache times - data doesn't change frequently
  staleTime: {
    static: 15 * 60 * 1000,        // 15 minutes for business settings, categories
    dashboard: 5 * 60 * 1000,       // 5 minutes for dashboard data
    orders: 2 * 60 * 1000,          // 2 minutes for order data
    monitoring: 5 * 60 * 1000,      // 5 minutes for health monitoring
    analytics: 10 * 60 * 1000,      // 10 minutes for analytics data
  },
  
  // Reduced refetch intervals
  refetchInterval: {
    disabled: false,                 // Disable auto-refetch by default
    slow: 5 * 60 * 1000,            // 5 minutes for background updates
    medium: 3 * 60 * 1000,          // 3 minutes for important data
    fast: 1 * 60 * 1000,            // 1 minute for critical monitoring
  },
  
  // Visibility-based refetching
  refetchIntervalInBackground: false,  // Stop refetching when tab not visible
  refetchOnWindowFocus: 'always' as const, // Only refetch when user returns
  
  // Retry configuration
  retry: 2,                            // Reduce from default 3 retries
  retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
};

// Cache management utilities
export class CacheOptimizer {
  private static visibilityTimer: NodeJS.Timeout | null = null;
  
  static setupVisibilityOptimization() {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Clear any pending timers when tab becomes hidden
        if (this.visibilityTimer) {
          clearTimeout(this.visibilityTimer);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
  
  // Get optimized config based on data type
  static getQueryConfig(type: keyof typeof OPTIMIZED_QUERY_CONFIG.staleTime) {
    return {
      staleTime: OPTIMIZED_QUERY_CONFIG.staleTime[type],
      refetchInterval: document.hidden ? false : OPTIMIZED_QUERY_CONFIG.refetchInterval.disabled,
      refetchIntervalInBackground: OPTIMIZED_QUERY_CONFIG.refetchIntervalInBackground,
      refetchOnWindowFocus: OPTIMIZED_QUERY_CONFIG.refetchOnWindowFocus,
      retry: OPTIMIZED_QUERY_CONFIG.retry,
      retryDelay: OPTIMIZED_QUERY_CONFIG.retryDelay,
    };
  }
}

// Smart polling utility
export const createSmartPoller = (
  callback: () => void, 
  intervalMs: number, 
  options: { pauseWhenHidden?: boolean } = {}
) => {
  let intervalId: NodeJS.Timeout | null = null;
  let isActive = false;
  
  const start = () => {
    if (isActive) return;
    
    const shouldRun = !options.pauseWhenHidden || !document.hidden;
    if (shouldRun) {
      intervalId = setInterval(callback, intervalMs);
      isActive = true;
    }
  };
  
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      isActive = false;
    }
  };
  
  const handleVisibilityChange = () => {
    if (options.pauseWhenHidden) {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }
  };
  
  if (options.pauseWhenHidden) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  
  start();
  
  return {
    stop: () => {
      stop();
      if (options.pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    }
  };
};