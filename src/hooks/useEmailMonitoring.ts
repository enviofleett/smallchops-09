import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalComplained: number;
  totalSuppressed: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  healthScore: number;
  issues: string[];
  recommendations: string[];
}

interface EmailMonitoringData {
  metrics: EmailMetrics | null;
  isLoading: boolean;
  error: string | null;
  refreshMetrics: (timeframe?: string) => Promise<void>;
}

export const useEmailMonitoring = (defaultTimeframe: string = '24h'): EmailMonitoringData => {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleError } = useErrorHandler();

  const refreshMetrics = async (timeframe: string = defaultTimeframe) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke(
        'email-delivery-monitor',
        {
          body: { timeframe }
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch email metrics');
      }

      setMetrics(data.report);
    } catch (err: any) {
      const errorMessage = `Failed to fetch email metrics: ${err.message}`;
      setError(errorMessage);
      handleError(err, 'Email Monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshMetrics();
  }, [defaultTimeframe]);

  return {
    metrics,
    isLoading,
    error,
    refreshMetrics
  };
};