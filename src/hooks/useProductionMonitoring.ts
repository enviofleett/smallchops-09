import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MonitoringHook {
  recordHealthMetric: (name: string, value: number, type: string, severity?: string) => Promise<void>;
  recordPerformanceMetric: (endpoint: string, method: string, responseTime: number, statusCode?: number, error?: string) => Promise<void>;
  createSecurityAlert: (type: string, severity: string, title: string, description: string) => Promise<void>;
  cleanupOldData: () => Promise<void>;
  isRecording: boolean;
}

export const useProductionMonitoring = (): MonitoringHook => {
  const { toast } = useToast();
  const isRecording = process.env.NODE_ENV === 'production';

  const recordHealthMetric = useCallback(async (
    name: string, 
    value: number, 
    type: string, 
    severity: string = 'info'
  ) => {
    if (!isRecording) return;
    
    try {
      const { error } = await supabase
        .from('business_analytics')
        .insert({
          metric_name: `health_${name}`,
          metric_value: value,
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString(),
          dimensions: {
            type,
            severity,
            component: 'frontend'
          }
        });

      if (error) {
        console.error('Failed to record health metric:', error);
      }

      // Show toast for critical health metrics
      if (severity === 'critical') {
        toast({
          title: "System Health Alert",
          description: `${name}: ${value}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error recording health metric:', error);
    }
  }, [isRecording, toast]);

  const recordPerformanceMetric = useCallback(async (
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode?: number,
    error?: string
  ) => {
    if (!isRecording) return;
    
    try {
      const { error: insertError } = await supabase
        .from('api_metrics')
        .insert({
          endpoint,
          metric_type: 'response_time',
          metric_value: responseTime,
          dimensions: {
            method,
            status_code: statusCode,
            error: error || null,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        });

      if (insertError) {
        console.error('Failed to record performance metric:', insertError);
      }

      // Alert for slow API responses
      if (responseTime > 3000) {
        toast({
          title: "Slow API Response",
          description: `${endpoint} took ${responseTime}ms`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error recording performance metric:', error);
    }
  }, [isRecording, toast]);

  const createSecurityAlert = useCallback(async (
    type: string,
    severity: string,
    title: string,
    description: string
  ) => {
    if (!isRecording) return;
    
    try {
      const { error } = await supabase
        .from('security_incidents')
        .insert({
          type,
          severity,
          request_data: {
            title,
            description,
            source: 'frontend',
            metadata: {
              user_agent: navigator.userAgent,
              url: window.location.href,
              timestamp: new Date().toISOString()
            }
          }
        });

      if (error) {
        console.error('Failed to create security alert:', error);
        return;
      }

      toast({
        title: "Security Alert Created",
        description: title,
        variant: severity === 'high' || severity === 'critical' ? "destructive" : "default"
      });
    } catch (error) {
      console.error('Error creating security alert:', error);
      toast({
        title: "Failed to Create Security Alert",
        description: "Please contact support if this persists",
        variant: "destructive"
      });
    }
  }, [isRecording, toast]);

  const cleanupOldData = useCallback(async () => {
    if (!isRecording) return;
    
    try {
      // Cleanup old metrics manually since we don't have the RPC function
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await Promise.all([
        supabase
          .from('api_metrics')
          .delete()
          .lt('timestamp', thirtyDaysAgo.toISOString()),
        supabase
          .from('business_analytics')
          .delete()
          .lt('created_at', thirtyDaysAgo.toISOString())
      ]);

      toast({
        title: "Data Cleanup Successful",
        description: "Old monitoring data has been cleaned up",
        variant: "default"
      });
    } catch (error) {
      console.error('Error during data cleanup:', error);
      toast({
        title: "Cleanup Error",
        description: "An error occurred during data cleanup",
        variant: "destructive"
      });
    }
  }, [isRecording, toast]);

  // Auto-record page load performance
  useEffect(() => {
    if (!isRecording) return;
    
    const recordPageLoad = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
        if (loadTime > 0) {
          recordPerformanceMetric(
            window.location.pathname,
            'GET',
            loadTime,
            200,
            undefined
          );
        }
      }
    };

    if (document.readyState === 'complete') {
      recordPageLoad();
    } else {
      window.addEventListener('load', recordPageLoad);
      return () => window.removeEventListener('load', recordPageLoad);
    }
  }, [isRecording, recordPerformanceMetric]);

  // Auto-record system health metrics
  useEffect(() => {
    if (!isRecording) return;
    
    const recordSystemHealth = () => {
      // Memory usage
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        recordHealthMetric('memory_usage', memoryUsagePercent, 'system');
      }
      
      // Connection status
      recordHealthMetric('connection_status', navigator.onLine ? 1 : 0, 'network');
    };

    recordSystemHealth();
    const interval = setInterval(recordSystemHealth, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [isRecording, recordHealthMetric]);

  return {
    recordHealthMetric,
    recordPerformanceMetric,
    createSecurityAlert,
    cleanupOldData,
    isRecording
  };
};