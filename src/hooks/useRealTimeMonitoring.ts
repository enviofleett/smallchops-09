// Phase 5.2: Real-time Monitoring Hooks
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CacheHealthMetrics {
  hitRate: number;
  missRate: number;
  errorRate: number;
  avgResponseTime: number;
  activeEntries: number;
  expiredEntries: number;
  lastUpdated: string;
}

export interface LockContentionMetrics {
  activeLocks: number;
  expiredLocks: number;
  averageLockDuration: number;
  lockConflicts: number;
  maxConcurrentLocks: number;
  lockHolders: Array<{
    orderId: string;
    adminId: string;
    duration: number;
    expiresIn: number;
  }>;
}

export interface PerformanceMetrics {
  orderUpdateLatency: number;
  successRate: number;
  errorsByType: Record<string, number>;
  throughput: number;
  peakLoad: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export const useRealTimeMonitoring = () => {
  const [cacheHealth, setCacheHealth] = useState<CacheHealthMetrics | null>(null);
  const [lockMetrics, setLockMetrics] = useState<LockContentionMetrics | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const alertRulesRef = useRef<AlertRule[]>([
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: 'error_rate > threshold',
      threshold: 0.05, // 5%
      severity: 'high',
      enabled: true
    },
    {
      id: 'low_cache_hit_rate',
      name: 'Low Cache Hit Rate',
      condition: 'cache_hit_rate < threshold',
      threshold: 0.8, // 80%
      severity: 'medium',
      enabled: true
    },
    {
      id: 'high_lock_contention',
      name: 'High Lock Contention',
      condition: 'active_locks > threshold',
      threshold: 10,
      severity: 'high',
      enabled: true
    },
    {
      id: 'slow_response_time',
      name: 'Slow Response Time',
      condition: 'avg_response_time > threshold',
      threshold: 2000, // 2 seconds
      severity: 'medium',
      enabled: true
    }
  ]);

  // Fetch cache health metrics
  const fetchCacheHealth = useCallback(async (): Promise<CacheHealthMetrics> => {
    try {
      // Get cache statistics from request_cache table
      const { data: cacheStats, error } = await supabase
        .from('request_cache')
        .select('status, created_at')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Last hour

      if (error) throw error;

      const now = Date.now();
      const total = cacheStats?.length || 0;
      const successful = cacheStats?.filter(entry => entry.status === 'success').length || 0;
      const failed = cacheStats?.filter(entry => entry.status === 'failed').length || 0;
      const expired = cacheStats?.filter(entry => 
        new Date(entry.created_at).getTime() < now - 1800000 // 30 minutes
      ).length || 0;

      const avgResponseTime = 1000; // Placeholder - calculate from actual data

      return {
        hitRate: total > 0 ? successful / total : 1,
        missRate: total > 0 ? (total - successful) / total : 0,
        errorRate: total > 0 ? failed / total : 0,
        avgResponseTime,
        activeEntries: total - expired,
        expiredEntries: expired,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching cache health:', error);
      return {
        hitRate: 0,
        missRate: 1,
        errorRate: 1,
        avgResponseTime: 0,
        activeEntries: 0,
        expiredEntries: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }, []);

  // Fetch lock contention metrics
  const fetchLockMetrics = useCallback(async (): Promise<LockContentionMetrics> => {
    try {
      // Get lock statistics from order_update_locks table
      const { data: locks, error } = await supabase
        .from('order_update_locks')
        .select('order_id, acquired_by, acquired_at, expires_at, released_at')
        .gte('acquired_at', new Date(Date.now() - 3600000).toISOString()); // Last hour

      if (error) throw error;

      const now = Date.now();
      const activeLocks = locks?.filter(lock => 
        !lock.released_at && new Date(lock.expires_at).getTime() > now
      ) || [];
      
      const expiredLocks = locks?.filter(lock => 
        !lock.released_at && new Date(lock.expires_at).getTime() <= now
      ) || [];

      // Calculate average lock duration
      const completedLocks = locks?.filter(lock => lock.released_at) || [];
      const durations = completedLocks.map(lock => 
        new Date(lock.released_at!).getTime() - new Date(lock.acquired_at).getTime()
      );
      
      const avgDuration = durations.length > 0 
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : 0;

      // Count conflicts (multiple locks for same order)
      const orderLockCounts = (locks || []).reduce((acc, lock) => {
        acc[lock.order_id] = (acc[lock.order_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const conflicts = Object.values(orderLockCounts).filter(count => count > 1).length;

      // Active lock holders
      const lockHolders = activeLocks.map(lock => ({
        orderId: lock.order_id,
        adminId: lock.acquired_by,
        duration: now - new Date(lock.acquired_at).getTime(),
        expiresIn: new Date(lock.expires_at).getTime() - now
      }));

      return {
        activeLocks: activeLocks.length,
        expiredLocks: expiredLocks.length,
        averageLockDuration: avgDuration,
        lockConflicts: conflicts,
        maxConcurrentLocks: Math.max(...Object.values(orderLockCounts), 0),
        lockHolders
      };
    } catch (error) {
      console.error('Error fetching lock metrics:', error);
      return {
        activeLocks: 0,
        expiredLocks: 0,
        averageLockDuration: 0,
        lockConflicts: 0,
        maxConcurrentLocks: 0,
        lockHolders: []
      };
    }
  }, []);

  // Fetch performance metrics
  const fetchPerformanceMetrics = useCallback(async (): Promise<PerformanceMetrics> => {
    try {
      // Get audit logs for performance analysis
      const { data: auditLogs, error } = await supabase
        .from('audit_logs')
        .select('action, category, message, new_values, event_time')
        .in('action', [
          'admin_order_status_updated_production',
          'admin_order_status_update_failed_production'
        ])
        .gte('event_time', new Date(Date.now() - 3600000).toISOString()); // Last hour

      if (error) throw error;

      const total = auditLogs?.length || 0;
      const successful = auditLogs?.filter(log => 
        log.action === 'admin_order_status_updated_production'
      ).length || 0;
      const failed = auditLogs?.filter(log => 
        log.action === 'admin_order_status_update_failed_production'
      ).length || 0;

      // Error breakdown
      const errorsByType = (auditLogs || [])
        .filter(log => log.action.includes('failed'))
        .reduce((acc, log) => {
          const errorValue = log.new_values as any;
          const errorType = errorValue?.error || 'unknown';
          acc[errorType] = (acc[errorType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      // Calculate throughput (operations per minute)
      const throughput = total > 0 ? (total / 60) : 0;

      // Determine system health
      const errorRate = total > 0 ? failed / total : 0;
      let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (errorRate > 0.1) systemHealth = 'critical';
      else if (errorRate > 0.05) systemHealth = 'degraded';

      return {
        orderUpdateLatency: 0, // Could be calculated from processing times
        successRate: total > 0 ? successful / total : 1,
        errorsByType,
        throughput,
        peakLoad: throughput, // Simplified - could track actual peak
        systemHealth
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return {
        orderUpdateLatency: 0,
        successRate: 0,
        errorsByType: { 'fetch_error': 1 },
        throughput: 0,
        peakLoad: 0,
        systemHealth: 'critical'
      };
    }
  }, []);

  // Check alert conditions
  const checkAlerts = useCallback((
    cache: CacheHealthMetrics,
    locks: LockContentionMetrics,
    perf: PerformanceMetrics
  ) => {
    const newAlerts: string[] = [];

    alertRulesRef.current.forEach(rule => {
      if (!rule.enabled) return;

      let triggered = false;
      
      switch (rule.id) {
        case 'high_error_rate':
          triggered = perf.successRate < (1 - rule.threshold);
          break;
        case 'low_cache_hit_rate':
          triggered = cache.hitRate < rule.threshold;
          break;
        case 'high_lock_contention':
          triggered = locks.activeLocks > rule.threshold;
          break;
        case 'slow_response_time':
          triggered = cache.avgResponseTime > rule.threshold;
          break;
      }

      if (triggered) {
        newAlerts.push(`${rule.severity.toUpperCase()}: ${rule.name}`);
      }
    });

    setAlerts(newAlerts);
  }, []);

  // Main monitoring function
  const updateMetrics = useCallback(async () => {
    try {
      const [cacheMetrics, lockStats, perfMetrics] = await Promise.all([
        fetchCacheHealth(),
        fetchLockMetrics(),
        fetchPerformanceMetrics()
      ]);

      setCacheHealth(cacheMetrics);
      setLockMetrics(lockStats);
      setPerformance(perfMetrics);

      // Check for alerts
      checkAlerts(cacheMetrics, lockStats, perfMetrics);

    } catch (error) {
      console.error('Error updating monitoring metrics:', error);
    }
  }, [fetchCacheHealth, fetchLockMetrics, fetchPerformanceMetrics, checkAlerts]);

  // Start/stop monitoring
  const startMonitoring = useCallback((interval: number = 10000) => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    updateMetrics(); // Initial update

    intervalRef.current = setInterval(() => {
      updateMetrics();
    }, interval);
  }, [isMonitoring, updateMetrics]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setIsMonitoring(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Manual refresh
  const refreshMetrics = useCallback(() => {
    updateMetrics();
  }, [updateMetrics]);

  return {
    // State
    cacheHealth,
    lockMetrics,
    performance,
    alerts,
    isMonitoring,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    refreshMetrics,
    
    // Alert management
    alertRules: alertRulesRef.current,
    updateAlertRules: (rules: AlertRule[]) => {
      alertRulesRef.current = rules;
    }
  };
};

export default useRealTimeMonitoring;