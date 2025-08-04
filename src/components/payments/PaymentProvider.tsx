import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentConfig {
  provider: string;
  publicKey: string;
  currency: string;
  testMode: boolean;
  availableChannels: string[];
  webhookUrl: string;
}

interface PaymentContextValue {
  config: PaymentConfig | null;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  isConfigValid: boolean;
}

const PaymentContext = createContext<PaymentContextValue | undefined>(undefined);

export const usePaymentConfig = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePaymentConfig must be used within PaymentProvider');
  }
  return context;
};

interface PaymentProviderProps {
  children: React.ReactNode;
}

export const PaymentProvider: React.FC<PaymentProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPaymentConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get active payment configuration
      const { data, error: configError } = await supabase.rpc('get_active_paystack_config');
      
      if (configError) {
        throw new Error(configError.message);
      }

      if (!data) {
        throw new Error('No payment configuration found');
      }

      const configData = Array.isArray(data) ? data[0] : data;

      // Get environment configuration for webhook URL
      const { data: envData } = await supabase
        .from('environment_config')
        .select('webhook_url')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setConfig({
        provider: 'paystack',
        publicKey: configData.public_key,
        currency: 'NGN',
        testMode: configData.test_mode,
        availableChannels: ['card', 'bank', 'ussd', 'mobile_money'],
        webhookUrl: envData?.webhook_url || ''
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment configuration';
      setError(errorMessage);
      console.error('Payment config error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentConfig();
  }, []);

  const refreshConfig = async () => {
    await loadPaymentConfig();
  };

  const isConfigValid = !!(config?.publicKey && config?.provider);

  const value: PaymentContextValue = {
    config,
    loading,
    error,
    refreshConfig,
    isConfigValid
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};