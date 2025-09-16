import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

/**
 * Hook for forcing fresh data fetches in production
 * Prevents stale data issues and ensures real-time updates
 */

export const useFreshData = () => {
  const queryClient = useQueryClient();
  const lastRefreshRef = useRef<Record<string, number>>({});

  /**
   * Force refresh specific query with rate limiting
   */
  const forceRefresh = useCallback(async (
    queryKey: (string | undefined)[],
    minInterval: number = 1000
  ) => {
    const keyString = queryKey.join('-');
    const now = Date.now();
    const lastRefresh = lastRefreshRef.current[keyString] || 0;

    // Rate limiting - prevent excessive refreshes
    if (now - lastRefresh < minInterval) {
      console.log(`⏱️ Rate limited refresh for: ${keyString}`);
      return;
    }

    lastRefreshRef.current[keyString] = now;

    console.log(`🔄 Force refreshing: ${keyString}`);

    try {
      // Remove from cache first
      queryClient.removeQueries({ queryKey });
      
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ 
        queryKey,
        refetchType: 'active'
      });

      console.log(`✅ Fresh data loaded for: ${keyString}`);
    } catch (error) {
      console.error(`❌ Failed to refresh: ${keyString}`, error);
    }
  }, [queryClient]);

  /**
   * Create a query that always fetches fresh data
   */
  const useFreshQuery = useCallback(<T>(
    queryKey: (string | undefined)[],
    queryFn: () => Promise<T>,
    options: any = {}
  ) => {
    return useQuery({
      queryKey,
      queryFn,
      ...options,
      staleTime: 0, // Always consider data stale
      gcTime: 0, // Don't cache
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    });
  }, []);

  /**
   * Reset all caches and force fresh data
   */
  const resetAndRefresh = useCallback(async () => {
    console.log('🔄 Resetting all caches and refreshing...');
    
    try {
      await queryClient.clear();
      await queryClient.refetchQueries();
      console.log('✅ All data refreshed');
    } catch (error) {
      console.error('❌ Failed to reset and refresh:', error);
    }
  }, [queryClient]);

  /**
   * Check if data is fresh (less than 30 seconds old)
   */
  const isDataFresh = useCallback((queryKey: (string | undefined)[]): boolean => {
    const queryState = queryClient.getQueryState(queryKey);
    if (!queryState) return false;

    const age = Date.now() - queryState.dataUpdatedAt;
    return age < 30000; // 30 seconds
  }, [queryClient]);

  return {
    forceRefresh,
    useFreshQuery,
    resetAndRefresh,
    isDataFresh
  };
};