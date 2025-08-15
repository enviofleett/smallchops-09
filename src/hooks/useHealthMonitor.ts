import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface HealthStatus {
  cart_tracking_calls: number;
  last_check: string;
  issues: string[];
  performance: {
    avg_response_time: number;
    error_rate: number;
  };
}

export const useHealthMonitor = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthStatus>({
    cart_tracking_calls: 0,
    last_check: new Date().toISOString(),
    issues: [],
    performance: {
      avg_response_time: 0,
      error_rate: 0
    }
  });

  // Monitor cart tracking API calls
  useEffect(() => {
    let callCount = 0;
    const startTime = Date.now();

    // Override fetch to monitor API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0]?.toString();
      if (url?.includes('track-cart-session')) {
        callCount++;
        if (callCount > 5) {
          console.warn('🚨 High cart tracking API calls detected:', callCount);
        }
      }
      return originalFetch(...args);
    };

    // Check metrics every 30 seconds
    const interval = setInterval(() => {
      const duration = (Date.now() - startTime) / 1000;
      const callsPerMinute = (callCount / duration) * 60;
      
      setHealthMetrics(prev => ({
        ...prev,
        cart_tracking_calls: callCount,
        last_check: new Date().toISOString(),
        issues: callsPerMinute > 10 ? ['High cart tracking frequency'] : [],
        performance: {
          ...prev.performance,
          error_rate: callsPerMinute > 10 ? 0.1 : 0
        }
      }));

      if (callsPerMinute > 10) {
        console.warn('🚨 Performance Issue: Cart tracking calls per minute:', callsPerMinute);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      window.fetch = originalFetch;
    };
  }, []);

  return {
    healthMetrics,
    isHealthy: healthMetrics.issues.length === 0
  };
};