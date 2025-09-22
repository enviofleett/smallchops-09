import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Shield, Database, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SystemHealth {
  database_status: 'healthy' | 'degraded' | 'error';
  lock_system_status: 'healthy' | 'degraded' | 'error';
  cache_system_status: 'healthy' | 'degraded' | 'error';
  concurrent_operations: number;
  avg_response_time: number;
  error_rate: number;
  last_check: string;
}

export const SystemHealthIndicator = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkSystemHealth = async () => {
    setIsLoading(true);
    try {
      const startTime = performance.now();

      // Test database connectivity
      const { data: dbTest, error: dbError } = await supabase
        .from('orders')
        .select('count')
        .limit(1);

      // Test lock system
      const { data: lockTest, error: lockError } = await supabase
        .from('order_update_locks')
        .select('count')
        .limit(1);

      // Test cache system  
      const { data: cacheTest, error: cacheError } = await supabase
        .from('request_cache')
        .select('count')
        .limit(1);

      // Calculate response time
      const responseTime = performance.now() - startTime;

      // Get concurrent operations count
      const { data: concurrentOps, count: lockCount } = await supabase
        .from('order_update_locks')
        .select('*', { count: 'exact', head: true })
        .is('released_at', null);

      // Calculate error rates from recent audit logs
      const { data: recentErrors, count: errorCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('event_time', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .ilike('message', '%error%');

      const { data: totalOperations, count: totalCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('event_time', new Date(Date.now() - 3600000).toISOString());

      const errorRate = totalCount 
        ? ((errorCount || 0) / totalCount) * 100
        : 0;

      setHealth({
        database_status: dbError ? 'error' : 'healthy',
        lock_system_status: lockError ? 'error' : 'healthy',
        cache_system_status: cacheError ? 'error' : 'healthy', 
        concurrent_operations: lockCount || 0,
        avg_response_time: Math.round(responseTime),
        error_rate: Math.round(errorRate * 100) / 100,
        last_check: new Date().toISOString()
      });

    } catch (error: any) {
      toast.error(`Health check failed: ${error.message}`);
      setHealth({
        database_status: 'error',
        lock_system_status: 'error', 
        cache_system_status: 'error',
        concurrent_operations: 0,
        avg_response_time: 0,
        error_rate: 100,
        last_check: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getOverallStatus = () => {
    if (!health) return 'unknown';
    
    const statuses = [
      health.database_status,
      health.lock_system_status,
      health.cache_system_status
    ];

    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            <span className="font-semibold">System Health</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(getOverallStatus())}>
              {getStatusIcon(getOverallStatus())}
              {getOverallStatus().toUpperCase()}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkSystemHealth}
              disabled={isLoading}
            >
              <Activity className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span className="text-sm">Database</span>
              </div>
              <Badge className={getStatusColor(health.database_status)}>
                {getStatusIcon(health.database_status)}
                {health.database_status}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Lock System</span>
              </div>
              <Badge className={getStatusColor(health.lock_system_status)}>
                {getStatusIcon(health.lock_system_status)}
                {health.lock_system_status}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Cache System</span>
              </div>
              <Badge className={getStatusColor(health.cache_system_status)}>
                {getStatusIcon(health.cache_system_status)}
                {health.cache_system_status}
              </Badge>
            </div>
          </div>
        )}

        {health && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {health.concurrent_operations}
              </div>
              <div className="text-xs text-gray-500">Active Operations</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">
                {health.avg_response_time}ms
              </div>
              <div className="text-xs text-gray-500">Response Time</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-purple-600">
                {health.error_rate}%
              </div>
              <div className="text-xs text-gray-500">Error Rate</div>
            </div>
          </div>
        )}

        {health && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last check: {new Date(health.last_check).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};