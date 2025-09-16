import { supabase } from '@/integrations/supabase/client';
import { clearProductsCache } from '@/api/optimizedProducts';

/**
 * Comprehensive Cache Management System for Production
 * Ensures fresh data loading and prevents stale data issues
 */

export class CacheManager {
  private static readonly CACHE_KEYS = {
    PRODUCTS: 'products-with-discounts',
    CATEGORIES: 'categories',
    CUSTOMER_ACCOUNTS: 'customer-accounts',
    PROFILES: 'profiles',
    BUSINESS_INFO: 'business-info',
    PROMOTIONS: 'promotions',
    CART_SESSIONS: 'cart-sessions'
  };

  private static queryClient: any = null;

  /**
   * Initialize the cache manager with query client
   */
  static initialize(queryClient: any) {
    this.queryClient = queryClient;
  }

  /**
   * Force clear ALL caches - Nuclear option for production issues
   */
  static async clearAllCaches(): Promise<void> {
    console.log('🧹 PRODUCTION: Clearing all caches...');
    
    try {
      // Clear React Query cache
      if (this.queryClient) {
        await this.queryClient.clear();
        console.log('✅ React Query cache cleared');
      }

      // Clear memory cache from optimized products
      clearProductsCache();
      console.log('✅ Memory cache cleared');

      // Clear localStorage caches
      this.clearBrowserCaches();
      console.log('✅ Browser caches cleared');

      // Clear session storage
      this.clearSessionCaches();
      console.log('✅ Session caches cleared');

      console.log('🎉 All caches cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
      throw error;
    }
  }

  /**
   * Clear specific data type cache
   */
  static async clearCacheByType(type: keyof typeof CacheManager.CACHE_KEYS): Promise<void> {
    console.log(`🧹 Clearing ${type} cache...`);
    
    const cacheKey = this.CACHE_KEYS[type];
    
    if (this.queryClient) {
      // Remove all queries that match the cache key pattern
      this.queryClient.removeQueries({ 
        queryKey: [cacheKey],
        exact: false 
      });
      
      // Invalidate to force refetch
      await this.queryClient.invalidateQueries({ 
        queryKey: [cacheKey],
        exact: false 
      });
    }
  }

  /**
   * Force fresh data fetch - bypasses all caches
   */
  static async forceFreshData(queryKey: string[]): Promise<void> {
    if (!this.queryClient) return;

    console.log(`🔄 Force fetching fresh data for:`, queryKey);
    
    // Remove from cache
    this.queryClient.removeQueries({ queryKey });
    
    // Invalidate and refetch
    await this.queryClient.invalidateQueries({ 
      queryKey,
      refetchType: 'active'
    });
  }

  /**
   * Clear browser-based caches
   */
  private static clearBrowserCaches(): void {
    const cacheKeys = [
      'cart_session_id',
      'cart_backup',
      'payment_in_progress',
      'session_storage_cache',
      'product_cache_',
      'category_cache_'
    ];

    cacheKeys.forEach(key => {
      // Remove exact matches
      localStorage.removeItem(key);
      
      // Remove keys that start with this pattern
      Object.keys(localStorage).forEach(storageKey => {
        if (storageKey.startsWith(key)) {
          localStorage.removeItem(storageKey);
        }
      });
    });
  }

  /**
   * Clear session storage caches
   */
  private static clearSessionCaches(): void {
    const sessionKeys = [
      'cart_backup',
      'payment_in_progress'
    ];

    sessionKeys.forEach(key => {
      sessionStorage.removeItem(key);
      
      // Remove keys that start with this pattern
      Object.keys(sessionStorage).forEach(storageKey => {
        if (storageKey.startsWith(key)) {
          sessionStorage.removeItem(storageKey);
        }
      });
    });
  }

  /**
   * Intelligent cache refresh - only refreshes stale data
   */
  static async smartRefresh(): Promise<void> {
    if (!this.queryClient) return;

    console.log('🔄 Smart cache refresh starting...');

    const staleQueries = this.queryClient.getQueriesData({});
    let refreshCount = 0;

    for (const [queryKey, data] of staleQueries) {
      const queryState = this.queryClient.getQueryState(queryKey);
      
      // Refresh if data is stale (older than 1 minute for production)
      if (queryState && queryState.dataUpdatedAt < Date.now() - 60000) {
        await this.queryClient.invalidateQueries({ queryKey });
        refreshCount++;
      }
    }

    console.log(`✅ Smart refresh completed: ${refreshCount} queries refreshed`);
  }

  /**
   * Production health check - validates cache integrity
   */
  static validateCacheHealth(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if query client is initialized
    if (!this.queryClient) {
      issues.push('Query client not initialized');
    }

    // Check localStorage size
    const localStorageSize = JSON.stringify(localStorage).length;
    if (localStorageSize > 5000000) { // 5MB limit
      issues.push(`localStorage size too large: ${(localStorageSize / 1000000).toFixed(2)}MB`);
    }

    // Check for stuck cache entries
    const now = Date.now();
    Object.keys(localStorage).forEach(key => {
      if (key.includes('cache') || key.includes('timestamp')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.timestamp && now - data.timestamp > 3600000) { // 1 hour
            issues.push(`Stale cache entry detected: ${key}`);
          }
        } catch (e) {
          issues.push(`Invalid cache entry: ${key}`);
        }
      }
    });

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Emergency cache cleanup - for production incidents
   */
  static async emergencyCleanup(): Promise<void> {
    console.log('🚨 EMERGENCY: Starting cache cleanup...');
    
    try {
      // Force clear everything
      await this.clearAllCaches();
      
      // Clear service worker cache if available
      if ('serviceWorker' in navigator && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('✅ Service worker caches cleared');
      }

      // Reload the page to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
      // Force reload as last resort
      window.location.reload();
    }
  }
}

/**
 * Hook for cache management in components
 */
export const useCacheManager = () => {
  return {
    clearAllCaches: CacheManager.clearAllCaches,
    clearCacheByType: CacheManager.clearCacheByType,
    forceFreshData: CacheManager.forceFreshData,
    smartRefresh: CacheManager.smartRefresh,
    validateCacheHealth: CacheManager.validateCacheHealth,
    emergencyCleanup: CacheManager.emergencyCleanup
  };
};