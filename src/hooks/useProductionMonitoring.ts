import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MonitoringHook {
  recordHealthMetric: (name: string, value: number, type?: string, severity?: string) => Promise<void>;
  recordPerformanceMetric: (endpoint: string, method: string, responseTime: number, statusCode: number, error?: any) => Promise<void>;
  createSecurityAlert: (type: string, severity: string, title: string, description: string) => Promise<void>;
  cleanupOldData: () => Promise<void>;
  isRecording: boolean;
}

export const useProductionMonitoring = (): MonitoringHook => {
  const [isRecording, setIsRecording] = useState(false);
  const { toast } = useToast();

  const recordHealthMetric = async (
    name: string, 
    value: number, 
    type: string = 'gauge', 
    severity: string = 'info'
  ) => {
    try {
      setIsRecording(true);
      
      const { error } = await supabase.rpc('record_health_metric', {
        p_metric_name: name,
        p_metric_value: value,
        p_metric_type: type,
        p_severity: severity,
        p_tags: {}
      });

      if (error) throw error;

      // If it's a critical metric, show a toast
      if (severity === 'critical') {
        toast({
          title: "Critical System Metric",
          description: `${name}: ${value}`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Error recording health metric:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const recordPerformanceMetric = async (
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    error?: any
  ) => {
    try {
      setIsRecording(true);

      const { error: recordError } = await supabase.rpc('record_performance_metric', {
        p_endpoint: endpoint,
        p_method: method,
        p_response_time_ms: responseTime,
        p_status_code: statusCode,
        p_user_id: null,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
        p_request_size_bytes: null,
        p_response_size_bytes: null,
        p_database_query_time_ms: null,
        p_cache_hit: false,
        p_error_details: error ? { error: error.message, stack: error.stack } : null
      });

      if (recordError) throw recordError;

      // Show toast for slow responses
      if (responseTime > 3000) {
        toast({
          title: "Slow API Response",
          description: `${endpoint} took ${responseTime}ms`,
          variant: "destructive"
        });
      }

    } catch (err: any) {
      console.error('Error recording performance metric:', err);
    } finally {
      setIsRecording(false);
    }
  };

  const createSecurityAlert = async (
    type: string,
    severity: string,
    title: string,
    description: string
  ) => {
    try {
      setIsRecording(true);

      const { error } = await supabase
        .from('security_alerts')
        .insert({
          alert_type: type,
          severity: severity,
          title: title,
          description: description,
          detection_method: 'manual',
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Security Alert Created",
        description: title,
        variant: severity === 'critical' || severity === 'high' ? "destructive" : "default"
      });

    } catch (error: any) {
      console.error('Error creating security alert:', error);
      toast({
        title: "Error creating security alert",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRecording(false);
    }
  };

  const cleanupOldData = async () => {
    try {
      setIsRecording(true);

      const { error } = await supabase.rpc('cleanup_monitoring_data');

      if (error) throw error;

      toast({
        title: "Data cleanup completed",
        description: "Old monitoring data has been cleaned up successfully"
      });

    } catch (error: any) {
      console.error('Error cleaning up data:', error);
      toast({
        title: "Error cleaning up data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRecording(false);
    }
  };

  // Auto-record page performance metrics
  useEffect(() => {
    const recordPageLoad = () => {
      if (performance.timing) {
        const pageLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        if (pageLoadTime > 0) {
          recordPerformanceMetric('page_load', 'GET', pageLoadTime, 200);
        }
      }
    };

    // Record page load time when component mounts
    if (document.readyState === 'complete') {
      recordPageLoad();
    } else {
      window.addEventListener('load', recordPageLoad);
      return () => window.removeEventListener('load', recordPageLoad);
    }
  }, []);

  // Auto-record system health metrics periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      // Record memory usage if available
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        const memoryUsagePercent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        
        await recordHealthMetric(
          'memory_usage_percent', 
          Math.round(memoryUsagePercent),
          'gauge',
          memoryUsagePercent > 90 ? 'critical' : memoryUsagePercent > 75 ? 'warning' : 'info'
        );
      }

      // Record connection status
      const isOnline = navigator.onLine;
      await recordHealthMetric('connection_status', isOnline ? 1 : 0, 'gauge', isOnline ? 'info' : 'critical');

    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return {
    recordHealthMetric,
    recordPerformanceMetric,
    createSecurityAlert,
    cleanupOldData,
    isRecording
  };
};