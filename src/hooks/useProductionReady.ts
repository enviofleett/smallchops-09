import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProductionReadinessStatus {
  isReady: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  lastChecked: Date;
}

export const useProductionReady = () => {
  const [status, setStatus] = useState<ProductionReadinessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkProductionReadiness = async () => {
    try {
      setIsLoading(true);
      
      // Check overall production readiness using the new function
      const { data: readinessData, error } = await supabase.rpc('check_production_readiness');
      
      if (error) {
        throw error;
      }
      
      // Type guard for the readiness data
      const data = readinessData as any;
      
      const combinedStatus: ProductionReadinessStatus = {
        isReady: data?.ready_for_production || false,
        score: data?.score || 0,
        issues: data?.issues || [],
        warnings: data?.warnings || [],
        lastChecked: new Date()
      };
      
      setStatus(combinedStatus);
    } catch (error) {
      console.error('Production readiness check failed:', error);
      setStatus({
        isReady: false,
        score: 0,
        issues: ['Unable to check production readiness'],
        warnings: [],
        lastChecked: new Date()
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkProductionReadiness();
  }, []);

  return {
    status,
    isLoading,
    refresh: checkProductionReadiness
  };
};