import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface HealthMetrics {
  hour: string;
  total_events: number;
  collision_events: number;
  avg_retry_count: number;
  unique_sessions: number;
  failed_events: number;
}

interface CollisionLog {
  id: string;
  original_dedupe_key: string;
  collision_count: number;
  first_collision_at: string;
  last_collision_at: string;
  order_id: string;
  event_type: string;
  admin_session_ids: string[];
  resolution_strategy: string;
}

/**
 * Production monitoring hook for communication events health
 * Tracks collision rates, retry counts, and system performance
 */
export const useProductionMonitoring = () => {
  // Monitor communication events health
  const { data: healthMetrics, error: healthError } = useQuery({
    queryKey: ['communication-events-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events_health')
        .select('*')
        .order('hour', { ascending: false })
        .limit(24);
      
      if (error) throw error;
      return data as HealthMetrics[];
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 2
  });

  // Monitor collision logs
  const { data: collisionLogs, error: collisionError } = useQuery({
    queryKey: ['collision-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events_collision_log')
        .select('*')
        .order('last_collision_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CollisionLog[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2
  });

  // Calculate current health score
  const healthScore = healthMetrics ? calculateHealthScore(healthMetrics) : null;

  return {
    healthMetrics,
    collisionLogs,
    healthScore,
    isHealthy: healthScore ? healthScore > 95 : null,
    errors: {
      health: healthError,
      collision: collisionError
    }
  };
};

function calculateHealthScore(metrics: HealthMetrics[]): number {
  if (!metrics.length) return 100;
  
  const recent = metrics[0];
  const collisionRate = recent.collision_events / Math.max(recent.total_events, 1);
  const failureRate = recent.failed_events / Math.max(recent.total_events, 1);
  
  // Health score: 100 - (collision_rate * 50) - (failure_rate * 50)
  return Math.max(0, 100 - (collisionRate * 50) - (failureRate * 50));
}