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
      
      // Check payment system readiness
      const { data: paystackReadiness } = await supabase.rpc('check_paystack_production_readiness');
      
      // Check overall production readiness
      const { data: generalReadiness } = await supabase.rpc('check_production_readiness');
      
      const combinedStatus: ProductionReadinessStatus = {
        isReady: (paystackReadiness as any)?.ready_for_production && (generalReadiness as any)?.ready_for_production,
        score: Math.min((paystackReadiness as any)?.score || 0, (generalReadiness as any)?.score || 0),
        issues: [
          ...((paystackReadiness as any)?.issues || []),
          ...((generalReadiness as any)?.issues || [])
        ],
        warnings: [
          ...((paystackReadiness as any)?.warnings || []),
          ...((generalReadiness as any)?.warnings || [])
        ],
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