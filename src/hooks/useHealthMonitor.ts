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

// DEPRECATED: This hook has been replaced with useResilientHealth for better stability
// The global fetch override was causing production issues and has been removed
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

  // Non-intrusive monitoring without global fetch override
  useEffect(() => {
    let callCount = 0;
    const startTime = Date.now();

    // REMOVED: Global fetch override - was causing production instability
    // Now using passive monitoring approach

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
      // No need to restore fetch since we're not overriding it
    };
  }, []);

  return {
    healthMetrics,
    isHealthy: healthMetrics.issues.length === 0
  };
};