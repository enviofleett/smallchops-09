import { useQuery } from '@tanstack/react-query';
import { OPTIMIZED_QUERY_CONFIG, CacheOptimizer } from '@/utils/optimizedQuery';
import { useEffect } from 'react';

// Optimized monitoring hook that respects visibility and reduces API calls
export const useOptimizedMonitoring = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: {
    type: keyof typeof OPTIMIZED_QUERY_CONFIG.staleTime;
    enabled?: boolean;
    priority?: 'low' | 'medium' | 'high';
  } = { type: 'monitoring' }
) => {
  // Set up visibility optimization
  useEffect(() => {
    return CacheOptimizer.setupVisibilityOptimization();
  }, []);

  // Get optimized configuration based on type and priority
  const getRefetchInterval = () => {
    if (document.hidden) return false;
    
    switch (options.priority) {
      case 'high': return OPTIMIZED_QUERY_CONFIG.refetchInterval.fast;
      case 'medium': return OPTIMIZED_QUERY_CONFIG.refetchInterval.medium;
      case 'low': 
      default: return OPTIMIZED_QUERY_CONFIG.refetchInterval.slow;
    }
  };

  const baseConfig = CacheOptimizer.getQueryConfig(options.type);
  
  return useQuery({
    queryKey,
    queryFn,
    staleTime: baseConfig.staleTime,
    retry: baseConfig.retry,
    retryDelay: baseConfig.retryDelay,
    refetchIntervalInBackground: baseConfig.refetchIntervalInBackground,
    refetchOnWindowFocus: baseConfig.refetchOnWindowFocus,
    refetchInterval: options.enabled !== false ? getRefetchInterval() : false,
    enabled: options.enabled !== false,
  });
};

// Specialized hooks for different monitoring types
export const useHealthMonitoring = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  enabled = true
) => {
  return useOptimizedMonitoring(queryKey, queryFn, {
    type: 'monitoring',
    priority: 'medium',
    enabled
  });
};

export const useDashboardMonitoring = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  enabled = true
) => {
  return useOptimizedMonitoring(queryKey, queryFn, {
    type: 'dashboard',
    priority: 'low',
    enabled
  });
};

export const useAnalyticsMonitoring = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  enabled = true
) => {
  return useOptimizedMonitoring(queryKey, queryFn, {
    type: 'analytics',
    priority: 'low',
    enabled
  });
};