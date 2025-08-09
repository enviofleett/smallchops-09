
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface PaystackConfig {
  publicKey: string;
  isTestMode: boolean;
  isValid: boolean;
  secretKey?: string;
  webhookSecret?: string;
  environment?: string;
}

export const usePaystackConfig = () => {
  const [config, setConfig] = useState<PaystackConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validatePublicKey = (key: string): boolean => {
    return key.startsWith('pk_') && key.length > 10;
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: configError } = await (supabase.rpc as any)('get_public_paystack_config');
      
      if (configError) {
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!data) {
        throw new Error('No Paystack configuration found. Please configure payment settings.');
      }

      const configData = Array.isArray(data) ? data[0] : data;

      if (!configData.public_key) {
        throw new Error('Paystack public key is missing from configuration.');
      }

      if (!validatePublicKey(configData.public_key)) {
        throw new Error('Invalid Paystack public key format.');
      }

      setConfig({
        publicKey: configData.public_key,
        isTestMode: configData.test_mode || false,
        isValid: true,
        environment: configData.test_mode ? 'test' : 'live'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment configuration';
      setError(errorMessage);
      console.error('Paystack config error:', err);
      
      toast({
        title: "Payment Configuration Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return {
    config,
    loading,
    error,
    reload: loadConfig
  };
};
