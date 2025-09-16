/**
 * Emergency cache utilities for handling cache synchronization failures
 */

export interface CacheEmergencyConfig {
  maxRetries: number;
  retryDelay: number;
  emergencyTimeout: number;
}

export const defaultCacheConfig: CacheEmergencyConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  emergencyTimeout: 5000
};

/**
 * Creates an emergency delivery schedule fallback object
 */
export const createEmergencyScheduleFallback = (orderId: string) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  return {
    id: `emergency-${orderId}-${Date.now()}`,
    order_id: orderId,
    delivery_date: today,
    delivery_time_start: '09:00',
    delivery_time_end: '17:00',
    requested_at: now.toISOString(),
    is_flexible: true,
    special_instructions: 'Schedule recovered via emergency fallback - please verify details',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    _emergency_fallback: true
  };
};

/**
 * Performs emergency cache synchronization with retries and timeout
 */
export const performEmergencyRefetch = async (
  refetchFn: () => Promise<any>,
  config: CacheEmergencyConfig = defaultCacheConfig
): Promise<{ success: boolean; data?: any; error?: string }> => {
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Refetch timeout after ${config.emergencyTimeout}ms`)), config.emergencyTimeout)
      );
      
      const refetchPromise = refetchFn();
      const result = await Promise.race([refetchPromise, timeoutPromise]);
      
      console.log(`✅ Emergency refetch successful on attempt ${attempt}`);
      return { success: true, data: result };
      
    } catch (error) {
      console.warn(`❌ Emergency refetch attempt ${attempt} failed:`, error.message);
      
      if (attempt < config.maxRetries) {
        console.log(`⏳ Retrying in ${config.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }
  }
  
  const errorMsg = `All ${config.maxRetries} emergency refetch attempts failed`;
  console.error(`🚨 ${errorMsg}`);
  
  return { 
    success: false, 
    error: errorMsg 
  };
};

/**
 * Logs cache operation metrics for monitoring
 */
export const logCacheOperation = (operation: string, orderId: string, success: boolean, details?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    orderId,
    success,
    details
  };
  
  console.log(`📊 Cache Operation: ${operation}`, logEntry);
  
  // In production, this could be sent to monitoring service
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cache-operation-logged', {
      detail: logEntry
    }));
  }
};

/**
 * Cache health check - verifies cache consistency
 */
export const checkCacheHealth = (queryClient: any, orderId: string) => {
  try {
    const cacheData = queryClient.getQueryData(['deliverySchedule', orderId]);
    const queryState = queryClient.getQueryState(['deliverySchedule', orderId]);
    
    const health = {
      hasData: !!cacheData,
      isStale: queryState?.isStale ?? true,
      isFetching: queryState?.isFetching ?? false,
      lastUpdated: queryState?.dataUpdatedAt,
      status: queryState?.status
    };
    
    console.log(`🏥 Cache health check for order ${orderId}:`, health);
    return health;
    
  } catch (error) {
    console.error(`❌ Cache health check failed:`, error);
    return { hasData: false, error: error.message };
  }
};