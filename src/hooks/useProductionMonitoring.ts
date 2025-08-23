import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { errorLogger, ApplicationError, ErrorSeverity, ErrorCategory } from '@/lib/error-handling';

interface MonitoringHook {
  recordHealthMetric: (name: string, value: number, type: string, severity?: string) => Promise<void>;
  recordPerformanceMetric: (endpoint: string, method: string, responseTime: number, statusCode?: number, error?: string) => Promise<void>;
  createSecurityAlert: (type: string, severity: string, title: string, description: string) => Promise<void>;
  cleanupOldData: () => Promise<void>;
  reportError: (error: Error | string, context?: string) => void;
  startOperation: (name: string) => void;
  endOperation: (name: string) => void;
  isRecording: boolean;
}

export const useProductionMonitoring = (): MonitoringHook => {
  const { toast } = useToast();
  const isRecording = import.meta.env.PROD;
  const operationStarts = new Map<string, number>();

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
        errorLogger.log(new ApplicationError(
          `Failed to record health metric: ${error.message}`,
          'MONITORING_ERROR',
          ErrorSeverity.LOW,
          ErrorCategory.SYSTEM,
          { metricName: name, value, type, severity, error }
        ));
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
      errorLogger.log(new ApplicationError(
        'Error recording health metric',
        'MONITORING_EXCEPTION',
        ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        { metricName: name, value, type, severity, originalError: error }
      ));
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
        errorLogger.log(new ApplicationError(
          `Failed to record performance metric: ${insertError.message}`,
          'PERFORMANCE_MONITORING_ERROR',
          ErrorSeverity.LOW,
          ErrorCategory.SYSTEM,
          { endpoint, method, responseTime, statusCode, error: insertError }
        ));
      }

      // Alert for slow API responses
      if (responseTime > 3000) {
        errorLogger.log(new ApplicationError(
          `Slow API response detected: ${endpoint}`,
          'SLOW_API_RESPONSE',
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK,
          { endpoint, method, responseTime, statusCode }
        ));
        
        toast({
          title: "Slow API Response",
          description: `${endpoint} took ${responseTime}ms`,
          variant: "destructive"
        });
      }
    } catch (error) {
      errorLogger.log(new ApplicationError(
        'Error recording performance metric',
        'PERFORMANCE_MONITORING_EXCEPTION',
        ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        { endpoint, method, responseTime, originalError: error }
      ));
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
        errorLogger.log(new ApplicationError(
          `Failed to create security alert: ${error.message}`,
          'SECURITY_ALERT_ERROR',
          ErrorSeverity.HIGH,
          ErrorCategory.SYSTEM,
          { type, severity, title, description, error }
        ));
        return;
      }

      // Log security alert to our error system
      errorLogger.log(new ApplicationError(
        `Security alert: ${title}`,
        'SECURITY_ALERT',
        severity === 'critical' ? ErrorSeverity.CRITICAL : 
        severity === 'high' ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        { type, severity, title, description }
      ));

      toast({
        title: "Security Alert Created",
        description: title,
        variant: severity === 'high' || severity === 'critical' ? "destructive" : "default"
      });
    } catch (error) {
      errorLogger.log(new ApplicationError(
        'Error creating security alert',
        'SECURITY_ALERT_EXCEPTION',
        ErrorSeverity.HIGH,
        ErrorCategory.SYSTEM,
        { type, severity, title, description, originalError: error }
      ));
      
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
      errorLogger.log(new ApplicationError(
        'Error during data cleanup',
        'CLEANUP_ERROR',
        ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        { originalError: error }
      ));
      
      toast({
        title: "Cleanup Error",
        description: "An error occurred during data cleanup",
        variant: "destructive"
      });
    }
  }, [isRecording, toast]);

  // Enhanced error reporting function
  const reportError = useCallback((error: Error | string, context?: string) => {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorObj = error instanceof Error ? error : new Error(error);
    
    const appError = new ApplicationError(
      `Production monitoring error: ${errorMessage}`,
      'MONITORING_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.SYSTEM,
      {
        context,
        originalError: errorObj,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    );

    errorLogger.log(appError);
  }, []);

  // Performance operation tracking
  const startOperation = useCallback((name: string) => {
    operationStarts.set(name, performance.now());
  }, []);

  const endOperation = useCallback((name: string) => {
    const startTime = operationStarts.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      operationStarts.delete(name);
      
      // Record performance metric
      recordPerformanceMetric(name, 'OPERATION', duration);
      
      // Log slow operations
      if (duration > 1000) {
        reportError(`Slow operation: ${name} took ${duration.toFixed(2)}ms`, 'performance');
      }
    }
  }, [recordPerformanceMetric, reportError]);

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
      try {
        // Memory usage
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
          recordHealthMetric('memory_usage', memoryUsagePercent, 'system');
        }
        
        // Connection status
        recordHealthMetric('connection_status', navigator.onLine ? 1 : 0, 'network');
        
        // Performance timing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
          recordHealthMetric('dom_content_loaded', domContentLoaded, 'performance');
        }
      } catch (error) {
        reportError(error instanceof Error ? error : new Error('System health check failed'), 'health_monitoring');
      }
    };

    recordSystemHealth();
    const interval = setInterval(recordSystemHealth, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [isRecording, recordHealthMetric, reportError]);

  return {
    recordHealthMetric,
    recordPerformanceMetric,
    createSecurityAlert,
    cleanupOldData,
    reportError,
    startOperation,
    endOperation,
    isRecording
  };
};