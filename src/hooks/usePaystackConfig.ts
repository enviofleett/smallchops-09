
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

      const { data, error: configError } = await supabase.rpc('get_public_paystack_config');
      
      if (configError) {
        // Silently handle missing RPC function - Paystack may not be configured
        if (configError.message?.includes('does not exist') || configError.message?.includes('not found')) {
          setConfig(null);
          setError('Paystack not configured');
          return;
        }
        throw new Error(`Configuration error: ${configError.message}`);
      }

      if (!data) {
        // No configuration found - this is okay, just means Paystack isn't set up
        setConfig(null);
        setError('Paystack not configured');
        return;
      }

      const configData = Array.isArray(data) ? data[0] : data;

      if (!configData?.public_key) {
        setConfig(null);
        setError('Paystack public key missing');
        return;
      }

      if (!validatePublicKey(configData.public_key)) {
        setConfig(null);
        setError('Invalid Paystack public key format');
        return;
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
      console.warn('Paystack config warning:', errorMessage);
      
      // Only show toast for critical errors, not missing configurations
      if (!errorMessage.includes('not configured') && !errorMessage.includes('not found')) {
        toast({
          title: "Payment Configuration Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
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
