import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Cache Recovery Utilities for Problematic Order Status Transitions
 * Provides targeted recovery for stuck cache entries
 */

export interface CacheRecoveryResult {
  success: boolean;
  entriesCleared: number;
  message: string;
}

/**
 * Force clear cache for a specific order
 */
export const forceOrderCacheCleanup = async (orderId: string): Promise<CacheRecoveryResult> => {
  try {
    console.log(`🧹 Force clearing cache for order ${orderId}`);
    
    const { data, error } = await supabase.rpc('force_clear_order_cache', {
      p_order_id: orderId
    });

    if (error) {
      console.error('❌ Force cache clear error:', error);
      return {
        success: false,
        entriesCleared: 0,
        message: `Failed to clear cache: ${error.message}`
      };
    }

    const entriesCleared = (data as any)?.entries_cleared || 0;
    console.log(`✅ Force cleared ${entriesCleared} cache entries for order ${orderId}`);
    
    return {
      success: true,
      entriesCleared,
      message: `Successfully cleared ${entriesCleared} cache entries`
    };
  } catch (error) {
    console.error('❌ Unexpected error during force cache clear:', error);
    return {
      success: false,
      entriesCleared: 0,
      message: 'Unexpected error during cache cleanup'
    };
  }
};

/**
 * Enhanced cache cleanup with configurable thresholds
 */
export const enhancedCacheCleanup = async (minutesThreshold: number = 2): Promise<CacheRecoveryResult> => {
  try {
    console.log(`🧹 Running enhanced cache cleanup with ${minutesThreshold} minute threshold`);
    
    const { data, error } = await supabase.rpc('cleanup_stuck_request_cache', {
      p_minutes_threshold: minutesThreshold
    });

    if (error) {
      console.error('❌ Enhanced cache cleanup error:', error);
      return {
        success: false,
        entriesCleared: 0,
        message: `Enhanced cleanup failed: ${error.message}`
      };
    }

    const totalCleaned = ((data as any)?.expired_cleaned || 0) + ((data as any)?.stuck_cleaned || 0);
    console.log(`✅ Enhanced cleanup completed: ${totalCleaned} entries removed`);
    
    return {
      success: true,
      entriesCleared: totalCleaned,
      message: `Enhanced cleanup completed: ${totalCleaned} entries removed`
    };
  } catch (error) {
    console.error('❌ Unexpected error during enhanced cache cleanup:', error);
    return {
      success: false,
      entriesCleared: 0,
      message: 'Unexpected error during enhanced cleanup'
    };
  }
};

/**
 * Smart recovery for problematic "preparing" → "ready" transitions
 */
export const recoverReadyStatusTransition = async (orderId: string): Promise<CacheRecoveryResult> => {
  try {
    console.log(`🔄 Recovering "ready" status transition for order ${orderId}`);
    
    // First, force clear the specific order's cache
    const clearResult = await forceOrderCacheCleanup(orderId);
    
    if (!clearResult.success) {
      return clearResult;
    }
    
    // Then run an aggressive cleanup for all stuck entries
    const cleanupResult = await enhancedCacheCleanup(1); // 1 minute threshold for aggressive cleanup
    
    const totalCleared = clearResult.entriesCleared + cleanupResult.entriesCleared;
    
    // Show success message
    toast.success(
      `Cache recovery completed: ${totalCleared} entries cleared. You can now retry the status update.`,
      { duration: 5000 }
    );
    
    return {
      success: true,
      entriesCleared: totalCleared,
      message: `Recovery completed: ${totalCleared} entries cleared`
    };
  } catch (error) {
    console.error('❌ Unexpected error during ready status recovery:', error);
    return {
      success: false,
      entriesCleared: 0,
      message: 'Unexpected error during status recovery'
    };
  }
};

/**
 * Hook for cache recovery operations
 */
export const useCacheRecovery = () => {
  return {
    forceOrderCacheCleanup,
    enhancedCacheCleanup,
    recoverReadyStatusTransition
  };
};