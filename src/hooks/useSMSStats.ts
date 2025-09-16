import { useState, useEffect } from 'react';
import { smsService } from '@/api/smsService';

interface SMSStats {
  total_sent: number;
  successful: number;
  failed: number;
  total_cost: number;
  success_rate: number;
}

export const useSMSStats = (days: number = 30) => {
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await smsService.getSMSStats(days);
      setStats(data);
    } catch (err) {
      console.error('Error fetching SMS stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch SMS stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [days]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
};