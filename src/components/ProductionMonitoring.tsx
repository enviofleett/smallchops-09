import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProductionMonitoringProps {
  children: React.ReactNode;
}

export const ProductionMonitoring: React.FC<ProductionMonitoringProps> = ({ children }) => {
  useEffect(() => {
    // Global error handler for unhandled promises
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Log to Supabase for production monitoring
      supabase.from('audit_logs').insert({
        action: 'unhandled_promise_rejection',
        category: 'Production Error',
        message: `Unhandled promise rejection: ${event.reason}`,
        new_values: {
          reason: String(event.reason),
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to log unhandled rejection:', error);
        }
      });
    };

    // Global error handler for JavaScript errors
    const handleError = (event: ErrorEvent) => {
      console.error('Global JavaScript error:', event.error);
      
      // Log to Supabase for production monitoring
      supabase.from('audit_logs').insert({
        action: 'javascript_error',
        category: 'Production Error',
        message: `JavaScript error: ${event.message}`,
        new_values: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to log JavaScript error:', error);
        }
      });
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Performance monitoring
    const logPerformanceMetrics = () => {
      if ('performance' in window && 'getEntriesByType' in performance) {
        const navEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navEntries) {
          const metrics = {
            domContentLoaded: navEntries.domContentLoadedEventEnd - navEntries.domContentLoadedEventStart,
            loadComplete: navEntries.loadEventEnd - navEntries.loadEventStart,
            domInteractive: navEntries.domInteractive - navEntries.requestStart,
            firstContentfulPaint: 0, // Would need additional setup for FCP
            timeToInteractive: navEntries.domInteractive - navEntries.requestStart
          };

          // Only log if we have meaningful data
          if (metrics.domContentLoaded > 0) {
            supabase.from('audit_logs').insert({
              action: 'performance_metrics',
              category: 'Production Monitoring',
              message: 'Page performance metrics recorded',
              new_values: {
                metrics,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
              }
            }).then(({ error }) => {
              if (error) {
                console.error('Failed to log performance metrics:', error);
              }
            });
          }
        }
      }
    };

    // Log performance metrics after page load
    const timer = setTimeout(logPerformanceMetrics, 2000);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      clearTimeout(timer);
    };
  }, []);

  return <>{children}</>;
};

export default ProductionMonitoring;