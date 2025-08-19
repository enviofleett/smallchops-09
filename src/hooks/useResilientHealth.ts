import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResilientSupabaseClient } from '@/lib/supabase-resilient-client';

interface HealthStatus {
  cart_tracking_calls: number;
  last_check: string;
  issues: string[];
  performance: {
    avg_response_time: number;
    error_rate: number;
  };
  circuit_breaker: {
    isOpen: boolean;
    failures: number;
    lastFailure: number;
  };
}

export const useResilientHealth = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthStatus>({
    cart_tracking_calls: 0,
    last_check: new Date().toISOString(),
    issues: [],
    performance: {
      avg_response_time: 0,
      error_rate: 0
    },
    circuit_breaker: {
      isOpen: false,
      failures: 0,
      lastFailure: 0
    }
  });

  // Non-intrusive monitoring without global fetch override
  useEffect(() => {
    let callCount = 0;
    const startTime = Date.now();

    // Store original fetch for monitoring specific patterns
    const originalFetch = window.fetch;
    
    // Light-weight monitoring wrapper (no global override)
    const monitorFetch = async (...args: Parameters<typeof fetch>) => {
      const url = args[0]?.toString();
      
      // Only monitor specific cart tracking calls
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
      const circuitBreakerStatus = ResilientSupabaseClient.getCircuitBreakerStatus();
      
      setHealthMetrics(prev => ({
        ...prev,
        cart_tracking_calls: callCount,
        last_check: new Date().toISOString(),
        issues: [
          ...(callsPerMinute > 10 ? ['High cart tracking frequency'] : []),
          ...(circuitBreakerStatus.isOpen ? ['Database circuit breaker open'] : [])
        ],
        performance: {
          ...prev.performance,
          error_rate: callsPerMinute > 10 ? 0.1 : 0
        },
        circuit_breaker: circuitBreakerStatus
      }));

      if (callsPerMinute > 10) {
        console.warn('🚨 Performance Issue: Cart tracking calls per minute:', callsPerMinute);
      }
    }, 30000);

    // Only apply light monitoring, no global fetch replacement
    if (typeof window !== 'undefined') {
      // Just store the monitoring function for manual use if needed
      (window as any).__fetchMonitor = monitorFetch;
    }

    return () => {
      clearInterval(interval);
      // Clean up monitoring reference
      if (typeof window !== 'undefined') {
        delete (window as any).__fetchMonitor;
      }
    };
  }, []);

  // Monitor Supabase health via resilient client
  const { data: supabaseHealth } = useQuery({
    queryKey: ['supabase-health'],
    queryFn: async () => {
      const { data, error } = await ResilientSupabaseClient.safeQuery(
        'performance_analytics',
        (query) => query.select('*').limit(1),
        { priority: 'low', fallbackData: [] }
      );
      
      return {
        isHealthy: !error,
        error: error?.message,
        data
      };
    },
    staleTime: 60000, // Check every minute
    refetchInterval: 60000,
    retry: false, // Let resilient client handle retries
  });

  return {
    healthMetrics: {
      ...healthMetrics,
      supabase_health: supabaseHealth
    },
    isHealthy: healthMetrics.issues.length === 0 && supabaseHealth?.isHealthy !== false
  };
};