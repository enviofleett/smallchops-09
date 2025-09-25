/**
 * Production Data Optimization Utilities
 * Ensures fresh data loading and optimal performance for live deployment
 */

import { CacheManager } from './cacheManager';
import { clearProductsCache } from '@/api/optimizedProducts';

export class ProductionOptimizer {
  /**
   * Initialize production-ready data fetching
   */
  static async initializeForProduction() {
    console.log('🚀 Initializing production data optimization...');
    
    try {
      // Clear any stale caches from previous sessions
      await CacheManager.smartRefresh();
      
      // Clear memory caches
      clearProductsCache();
      
      // Health check
      const health = CacheManager.validateCacheHealth();
      if (!health.healthy) {
        console.warn('Cache health issues detected:', health.issues);
        await CacheManager.clearAllCaches();
      }
      
      console.log('✅ Production optimization complete');
    } catch (error) {
      console.error('❌ Production optimization failed:', error);
    }
  }

  /**
   * Performance monitoring for production
   */
  static monitorPerformance() {
    if (typeof window !== 'undefined') {
      // Monitor page load performance
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.fetchStart;
            console.log(`📊 Page load time: ${loadTime}ms`);
            
            if (loadTime > 3000) {
              console.warn('⚠️ Slow page load detected, consider cache optimization');
            }
          }
        }, 1000);
      });

      // Monitor cache hit rates
      const originalFetch = window.fetch;
      let cacheHits = 0;
      let totalRequests = 0;

      window.fetch = async (...args) => {
        totalRequests++;
        const response = await originalFetch(...args);
        
        if (response.headers.get('x-cache') === 'HIT') {
          cacheHits++;
        }
        
        // Log cache efficiency every 10 requests
        if (totalRequests % 10 === 0) {
          const hitRate = (cacheHits / totalRequests) * 100;
          console.log(`📈 Cache hit rate: ${hitRate.toFixed(1)}%`);
        }
        
        return response;
      };
    }
  }

  /**
   * Detect and fix common production data issues
   */
  static async detectAndFixDataIssues() {
    console.log('🔍 Scanning for data issues...');
    
    const issues = [];
    
    // Check for excessive API calls
    const performanceEntries = performance.getEntriesByType('resource');
    const apiCalls = performanceEntries.filter(entry => 
      entry.name.includes('supabase.co') && 
      entry.startTime > Date.now() - 30000 // Last 30 seconds
    );
    
    if (apiCalls.length > 20) {
      issues.push(`Excessive API calls detected: ${apiCalls.length} in 30s`);
      
      // Auto-fix: clear caches to prevent duplicate calls
      await CacheManager.clearAllCaches();
    }
    
    // Check localStorage size
    const storageSize = JSON.stringify(localStorage).length;
    if (storageSize > 5000000) { // 5MB
      issues.push(`Large localStorage detected: ${(storageSize / 1000000).toFixed(2)}MB`);
      
      // Auto-fix: clean up old cache entries
      CacheManager.clearAllCaches();
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Data issues detected and fixed:', issues);
    } else {
      console.log('✅ No data issues detected');
    }
  }
}

// Auto-initialize on import for production
if (typeof window !== 'undefined') {
  ProductionOptimizer.initializeForProduction();
  ProductionOptimizer.monitorPerformance();
  
  // Schedule periodic issue detection
  setInterval(() => {
    ProductionOptimizer.detectAndFixDataIssues();
  }, 60000); // Every minute
}