import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ErrorReport {
  component: string;
  error: string;
  user_id?: string;
  url: string;
  timestamp: string;
  user_agent: string;
  additional_info?: any;
}

interface PerformanceMetric {
  component: string;
  load_time: number;
  user_id?: string;
  url: string;
  timestamp: string;
}

export const useProductionMonitoring = () => {
  const reportError = useCallback(async (error: Error, component: string, additionalInfo?: any) => {
    try {
      const errorReport: ErrorReport = {
        component,
        error: error.message + (error.stack ? `\n${error.stack}` : ''),
        url: window.location.href,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        additional_info: additionalInfo
      };

      // Log to console for immediate debugging
      console.error(`[${component}] Production Error:`, error, additionalInfo);

      // Store in audit logs for tracking
      await supabase.from('audit_logs').insert({
        action: 'production_error',
        category: 'Error Tracking',
        message: `[${errorReport.component}] ${errorReport.error}`,
        new_values: {
          component: errorReport.component,
          url: errorReport.url,
          user_agent: errorReport.user_agent,
          additional_info: errorReport.additional_info,
          severity: 'error'
        }
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }, []);

  const reportPerformance = useCallback(async (component: string, loadTime: number) => {
    try {
      const performanceMetric: PerformanceMetric = {
        component,
        load_time: loadTime,
        url: window.location.href,
        timestamp: new Date().toISOString()
      };

      // Only report slow loads (> 2 seconds)
      if (loadTime > 2000) {
        console.warn(`[${component}] Slow load detected: ${loadTime}ms`);
        
        await supabase.from('audit_logs').insert({
          action: 'performance_slow_load',
          category: 'Performance Monitoring',
          message: `Slow load detected: ${performanceMetric.component} (${performanceMetric.load_time}ms)`,
          new_values: {
            component: performanceMetric.component,
            load_time_ms: performanceMetric.load_time,
            url: performanceMetric.url,
            recorded_at: performanceMetric.timestamp
          }
        });
      }
    } catch (reportingError) {
      console.error('Failed to report performance:', reportingError);
    }
  }, []);

  const reportOrderVisibilityIssue = useCallback(async (details: any) => {
    try {
      console.error('[ORDER_VISIBILITY] Issue detected:', details);
      
      await supabase.from('audit_logs').insert({
        action: 'order_visibility_issue',
        category: 'Order Management',
        message: 'Order visibility issue detected',
        new_values: {
          component: 'order_visibility',
          details: details,
          url: window.location.href,
          user_agent: navigator.userAgent,
          severity: 'warning'
        }
      });
    } catch (error) {
      console.error('Failed to report order visibility issue:', error);
    }
  }, []);

  // Set up global error handling
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      reportError(new Error(event.message), 'global_error_handler', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError(
        new Error(event.reason?.message || 'Unhandled Promise Rejection'),
        'global_promise_handler',
        { reason: event.reason }
      );
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [reportError]);

  return {
    reportError,
    reportPerformance,
    reportOrderVisibilityIssue
  };
};