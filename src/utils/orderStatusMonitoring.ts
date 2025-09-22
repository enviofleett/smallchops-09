import { supabase } from '@/integrations/supabase/client';

/**
 * Production monitoring utilities for order status updates
 */

export interface OrderUpdateHealthMetrics {
  success_rate: number;
  avg_response_time_ms: number;
  concurrent_errors: number;
  lock_conflicts: number;
  last_24h_updates: number;
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
}

export interface LockStatus {
  is_locked: boolean;
  locking_admin_id?: string;
  locking_admin_name?: string;
  seconds_remaining?: number;
  expires_at?: string;
}

/**
 * Check the health of order status update system
 */
export async function checkOrderUpdateHealth(): Promise<OrderUpdateHealthMetrics | null> {
  try {
    const { data, error } = await supabase.rpc('get_system_health_metrics');
    
    if (error) {
      console.error('❌ Failed to get system health metrics:', error);
      return null;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    // Safely convert the database response to our interface
    const metrics = data as any;
    return {
      success_rate: metrics.success_rate || 0,
      avg_response_time_ms: metrics.avg_response_time_ms || 0,
      concurrent_errors: metrics.concurrent_errors || 0,
      lock_conflicts: metrics.lock_conflicts || 0,
      last_24h_updates: metrics.last_24h_updates || 0,
      status: metrics.status || 'unknown',
      timestamp: metrics.timestamp || new Date().toISOString()
    } as OrderUpdateHealthMetrics;
  } catch (error) {
    console.error('❌ Error checking order update health:', error);
    return null;
  }
}

/**
 * Check if an order is currently locked for updates
 */
export async function checkOrderLockStatus(orderId: string): Promise<LockStatus | null> {
  try {
    const { data, error } = await supabase.rpc('get_order_lock_info', { 
      p_order_id: orderId 
    });
    
    if (error) {
      console.error('❌ Failed to get order lock status:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return { is_locked: false };
    }

    const lockInfo = data[0];
    return {
      is_locked: lockInfo.is_locked,
      locking_admin_id: lockInfo.locking_admin_id,
      locking_admin_name: lockInfo.locking_admin_name,
      seconds_remaining: lockInfo.seconds_remaining,
      expires_at: lockInfo.lock_expires_at
    };
  } catch (error) {
    console.error('❌ Error checking order lock status:', error);
    return null;
  }
}

/**
 * Force cleanup of expired locks and stuck cache entries
 */
export async function performProactiveCleanup(orderId?: string, reason = 'manual_cleanup') {
  try {
    if (orderId) {
      // Order-specific cleanup
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'proactive_cleanup',
          orderId,
          reason
        }
      });

      if (error) {
        console.error('❌ Failed to perform order-specific cleanup:', error);
        return false;
      }

      console.log('✅ Order cleanup completed:', data);
      return true;
    } else {
      // System-wide cleanup
      const { data: lockCleanup, error: lockError } = await supabase.rpc('cleanup_expired_locks');
      const { data: cacheCleanup, error: cacheError } = await supabase.rpc('cleanup_stuck_request_cache');

      if (lockError) console.warn('⚠️ Lock cleanup failed:', lockError);
      if (cacheError) console.warn('⚠️ Cache cleanup failed:', cacheError);

      console.log('✅ System cleanup completed:', { lockCleanup, cacheCleanup });
      return !lockError && !cacheError;
    }
  } catch (error) {
    console.error('❌ Error performing cleanup:', error);
    return false;
  }
}

/**
 * Log enhanced order update metrics for 409 conflict monitoring
 */
export async function logOrderUpdateMetric(
  orderId: string,
  operation: string,
  success: boolean,
  responseTimeMs?: number,
  errorDetails?: any,
  conflictData?: {
    lockWaitTime?: number;
    retryAttempts?: number;
    conflictResolutionMethod?: string;
    cacheCleared?: boolean;
    lockAcquired?: boolean;
    concurrentAdminSessions?: any;
  }
) {
  try {
    // Enhanced logging to order_update_metrics table
    await supabase.rpc('log_order_update_metric', {
      p_operation: operation,
      p_order_id: orderId,
      p_admin_user_id: null, // Will be set by RLS context
      p_duration_ms: responseTimeMs || 0,
      p_status: success ? 'success' : 'error',
      p_error_code: errorDetails?.code || null,
      p_error_message: errorDetails?.message || null,
      p_correlation_id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      p_lock_wait_time_ms: conflictData?.lockWaitTime || null,
      p_retry_attempts: conflictData?.retryAttempts || 0,
      p_conflict_resolution_method: conflictData?.conflictResolutionMethod || null,
      p_concurrent_admin_sessions: conflictData?.concurrentAdminSessions || null,
      p_lock_acquired: conflictData?.lockAcquired || false,
      p_cache_cleared: conflictData?.cacheCleared || false,
      p_cache_hit: null, // Could be tracked from cache operations
      p_database_query_time_ms: null,
      p_total_processing_time_ms: responseTimeMs || null
    });

    // Also log to audit_logs for backwards compatibility
    await supabase.from('audit_logs').insert([{
      action: 'order_status_update_metric_enhanced',
      category: 'Performance Monitoring',
      message: `Enhanced order update metric: ${operation}`,
      entity_id: orderId,
      new_values: {
        operation,
        success,
        response_time_ms: responseTimeMs,
        error_details: errorDetails,
        conflict_data: conflictData,
        timestamp: new Date().toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
      }
    }]);
  } catch (error) {
    // Don't throw - this is just monitoring
    console.warn('⚠️ Failed to log enhanced order update metric:', error);
  }
}

/**
 * Get recent order update errors for debugging
 */
export async function getRecentOrderUpdateErrors(hours = 24) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .ilike('action', '%order%status%')
      .ilike('message', '%error%')
      .gte('event_time', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('event_time', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Failed to get recent errors:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error getting recent order update errors:', error);
    return [];
  }
}

/**
 * Production-ready status update with full monitoring
 */
export async function monitoredStatusUpdate(
  orderId: string, 
  newStatus: string,
  updateFunction: () => Promise<any>
) {
  const startTime = Date.now();
  let success = false;
  let errorDetails = null;

  try {
    // Pre-flight check
    const lockStatus = await checkOrderLockStatus(orderId);
    if (lockStatus?.is_locked && lockStatus.locking_admin_id) {
      throw new Error(`Order locked by ${lockStatus.locking_admin_name || 'another admin'}`);
    }

    // Execute the update
    const result = await updateFunction();
    success = true;
    
    // Log success metric
    await logOrderUpdateMetric(
      orderId, 
      `status_update_${newStatus}`, 
      true, 
      Date.now() - startTime
    );

    return result;
  } catch (error) {
    errorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    // Log failure metric
    await logOrderUpdateMetric(
      orderId, 
      `status_update_${newStatus}`, 
      false, 
      Date.now() - startTime,
      errorDetails
    );

    throw error;
  }
}