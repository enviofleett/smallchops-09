import { useState, useCallback } from 'react';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
}

export const useProductionMonitoring = () => {
  const [isReporting, setIsReporting] = useState(false);

  const reportError = useCallback(async (
    error: Error,
    context: string,
    additionalInfo?: any
  ) => {
    if (isReporting) return; // Prevent duplicate reports
    
    setIsReporting(true);
    
    try {
      const errorData: ErrorContext = {
        component: context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...additionalInfo
      };

      console.error('🚨 Production Error:', {
        message: error.message,
        stack: error.stack,
        context,
        errorData
      });

      // In a real app, you'd send this to your error tracking service
      // await sendToErrorTrackingService(error, errorData);
      
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    } finally {
      setIsReporting(false);
    }
  }, [isReporting]);

  const reportPerformance = useCallback((metric: string, value: number, context?: string) => {
    try {
      console.log('📊 Performance Metric:', { metric, value, context, timestamp: Date.now() });
      
      // In a real app, you'd send this to your analytics service
      // await sendToAnalyticsService(metric, value, context);
      
    } catch (error) {
      console.error('Failed to report performance metric:', error);
    }
  }, []);

  const reportUserAction = useCallback((action: string, data?: any) => {
    try {
      console.log('👤 User Action:', { action, data, timestamp: Date.now() });
      
      // In a real app, you'd send this to your analytics service
      // await sendToAnalyticsService('user_action', { action, ...data });
      
    } catch (error) {
      console.error('Failed to report user action:', error);
    }
  }, []);

  const reportOrderVisibilityIssue = useCallback((issueType: string, data?: any) => {
    try {
      console.log('📋 Order Visibility Issue:', { issueType, data, timestamp: Date.now() });
      
      // In a real app, you'd send this to your error tracking service
      // await sendToErrorTrackingService('order_visibility_issue', { issueType, ...data });
      
    } catch (error) {
      console.error('Failed to report order visibility issue:', error);
    }
  }, []);

  return {
    reportError,
    reportPerformance,
    reportUserAction,
    reportOrderVisibilityIssue,
    isReporting
  };
};