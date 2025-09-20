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

export interface ConflictResolutionMetrics {
  conflictRate: number;
  avgConflictResolutionTime: number;
  retrySuccessRate: number;
  cacheBypassRate: number;
  lockWaitTimes: number[];
  concurrentSessionConflicts: number;
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
  const [conflictMetrics, setConflictMetrics] = useState<ConflictResolutionMetrics | null>(null);
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
    },
    {
      id: 'high_conflict_rate',
      name: 'High 409 Conflict Rate',
      condition: 'conflict_rate > threshold',
      threshold: 0.1, // 10%
      severity: 'high',
      enabled: true
    },
    {
      id: 'slow_conflict_resolution',
      name: 'Slow Conflict Resolution',
      condition: 'avg_conflict_resolution_time > threshold',
      threshold: 3000, // 3 seconds
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

  // Fetch performance metrics from enhanced order_update_metrics
  const fetchPerformanceMetrics = useCallback(async (): Promise<PerformanceMetrics> => {
    try {
      const { data: metrics, error } = await supabase
        .from('order_update_metrics')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 3600000).toISOString()); // Last hour

      if (error) throw error;

      const total = metrics?.length || 0;
      const successful = metrics?.filter(m => m.status === 'success').length || 0;
      const failed = metrics?.filter(m => m.status === 'error').length || 0;

      // Error breakdown
      const errorsByType = (metrics || [])
        .filter(m => m.status === 'error')
        .reduce((acc, metric) => {
          const errorType = metric.error_code || 'unknown';
          acc[errorType] = (acc[errorType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      // Calculate average latency from duration_ms
      const avgLatency = total > 0 
        ? (metrics || []).reduce((sum, m) => sum + (m.duration_ms || 0), 0) / total
        : 0;

      // Calculate throughput (operations per minute)
      const throughput = total > 0 ? (total / 60) : 0;

      // Determine system health
      const errorRate = total > 0 ? failed / total : 0;
      let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (errorRate > 0.1) systemHealth = 'critical';
      else if (errorRate > 0.05) systemHealth = 'degraded';

      return {
        orderUpdateLatency: avgLatency,
        successRate: total > 0 ? successful / total : 1,
        errorsByType,
        throughput,
        peakLoad: throughput,
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

  // Fetch 409 conflict resolution metrics
  const fetchConflictMetrics = useCallback(async (): Promise<ConflictResolutionMetrics> => {
    try {
      const { data: metrics, error } = await supabase
        .from('order_update_metrics')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .in('status', ['conflict', 'success', 'error']);

      if (error) throw error;

      const total = metrics?.length || 0;
      const conflicts = metrics?.filter(m => m.status === 'conflict') || [];
      const conflictResolutions = metrics?.filter(m => 
        m.conflict_resolution_method && m.status === 'success'
      ) || [];

      // Calculate conflict rate
      const conflictRate = total > 0 ? conflicts.length / total : 0;

      // Calculate average conflict resolution time
      const avgConflictResolutionTime = conflictResolutions.length > 0
        ? conflictResolutions.reduce((sum, m) => sum + (m.duration_ms || 0), 0) / conflictResolutions.length
        : 0;

      // Calculate retry success rate
      const retries = metrics?.filter(m => m.retry_attempts && m.retry_attempts > 0) || [];
      const successfulRetries = retries.filter(m => m.status === 'success');
      const retrySuccessRate = retries.length > 0 ? successfulRetries.length / retries.length : 1;

      // Calculate cache bypass rate
      const bypasses = metrics?.filter(m => m.cache_cleared === true) || [];
      const cacheBypassRate = total > 0 ? bypasses.length / total : 0;

      // Extract lock wait times
      const lockWaitTimes = (metrics || [])
        .map(m => m.lock_wait_time_ms)
        .filter(time => time !== null && time !== undefined);

      // Count concurrent session conflicts
      const concurrentConflicts = (metrics || [])
        .filter(m => m.concurrent_admin_sessions && 
          Object.keys(m.concurrent_admin_sessions).length > 1
        ).length;

      return {
        conflictRate,
        avgConflictResolutionTime,
        retrySuccessRate,
        cacheBypassRate,
        lockWaitTimes,
        concurrentSessionConflicts: concurrentConflicts
      };
    } catch (error) {
      console.error('Error fetching conflict metrics:', error);
      return {
        conflictRate: 0,
        avgConflictResolutionTime: 0,
        retrySuccessRate: 1,
        cacheBypassRate: 0,
        lockWaitTimes: [],
        concurrentSessionConflicts: 0
      };
    }
  }, []);

  // Check alert conditions
  const checkAlerts = useCallback((
    cache: CacheHealthMetrics,
    locks: LockContentionMetrics,
    perf: PerformanceMetrics,
    conflicts: ConflictResolutionMetrics
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
        case 'high_conflict_rate':
          triggered = conflicts.conflictRate > rule.threshold;
          break;
        case 'slow_conflict_resolution':
          triggered = conflicts.avgConflictResolutionTime > rule.threshold;
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
      const [cacheMetrics, lockStats, perfMetrics, conflictStats] = await Promise.all([
        fetchCacheHealth(),
        fetchLockMetrics(),
        fetchPerformanceMetrics(),
        fetchConflictMetrics()
      ]);

      setCacheHealth(cacheMetrics);
      setLockMetrics(lockStats);
      setPerformance(perfMetrics);
      setConflictMetrics(conflictStats);

      // Check for alerts
      checkAlerts(cacheMetrics, lockStats, perfMetrics, conflictStats);

    } catch (error) {
      console.error('Error updating monitoring metrics:', error);
    }
  }, [fetchCacheHealth, fetchLockMetrics, fetchPerformanceMetrics, fetchConflictMetrics, checkAlerts]);

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
    conflictMetrics,
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