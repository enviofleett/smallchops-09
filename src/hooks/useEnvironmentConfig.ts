import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EnvironmentConfig {
  id?: string;
  environment: string;
  isLiveMode: boolean;
  paystackLivePublicKey?: string;
  paystackLiveSecretKey?: string;
  paystackTestPublicKey?: string;
  paystackTestSecretKey?: string;
  webhookUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentIntegrationConfig {
  id?: string;
  provider: string;
  publicKey?: string;
  secretKey?: string;
  livePublicKey?: string;
  liveSecretKey?: string;
  webhookSecret?: string;
  liveWebhookSecret?: string;
  testMode: boolean;
  connectionStatus: string;
  environment: string;
}

export interface ActiveKeys {
  publicKey: string;
  testMode: boolean;
  environment: string;
}

export const useEnvironmentConfig = () => {
  const [config, setConfig] = useState<EnvironmentConfig | null>(null);
  const [paymentIntegration, setPaymentIntegration] = useState<PaymentIntegrationConfig | null>(null);
  const [activeKeys, setActiveKeys] = useState<ActiveKeys | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('payment-environment-manager', {
        method: 'GET'
      });

      if (error) {
        // Production fallback - use default config
        console.warn('Environment config unavailable, using defaults:', error.message);
        setConfig({
          environment: 'production',
          isLiveMode: true
        });
        return;
      }

      if (data?.success) {
        setConfig(data.data.environment);
        setPaymentIntegration(data.data.paymentIntegration);
        setActiveKeys(data.data.activeKeys);
      } else {
        // Production fallback
        setConfig({
          environment: 'production', 
          isLiveMode: true
        });
      }
    } catch (error) {
      // Silent fallback for production - don't show error toasts
      console.warn('Environment config service unavailable, using production defaults');
      setConfig({
        environment: 'production',
        isLiveMode: true
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async (newConfig: EnvironmentConfig) => {
    try {
      setSaving(true);
      
      const { data, error } = await supabase.functions.invoke('payment-environment-manager', {
        method: 'POST',
        body: newConfig
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setConfig(data.data);
        toast({
          title: "Configuration Updated",
          description: data.message || "Environment configuration updated successfully",
        });
        
        // Reload to get updated active keys
        await loadConfiguration();
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save environment configuration:', error);
      toast({
        title: "Save Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const switchEnvironment = async (isLive: boolean) => {
    if (!config) return false;

    const updatedConfig = {
      ...config,
      isLiveMode: isLive,
      environment: isLive ? 'production' : 'development'
    };

    return await saveConfiguration(updatedConfig);
  };

  const isProductionReady = (): boolean => {
    if (!paymentIntegration || !config) return false;

    // Check if live keys are configured when in live mode
    if (config.isLiveMode) {
      return !!(
        paymentIntegration.livePublicKey && 
        paymentIntegration.liveSecretKey && 
        paymentIntegration.liveWebhookSecret
      );
    }

    // Check if test keys are configured
    return !!(
      paymentIntegration.publicKey && 
      paymentIntegration.secretKey && 
      paymentIntegration.webhookSecret
    );
  };

  const getEnvironmentStatus = () => {
    if (!config || !paymentIntegration) {
      return { status: 'not_configured', message: 'Configuration not loaded' };
    }

    if (config.isLiveMode) {
      if (isProductionReady()) {
        return { status: 'live', message: 'Live environment - Production ready' };
      } else {
        return { status: 'live_incomplete', message: 'Live environment - Missing configuration' };
      }
    } else {
      if (paymentIntegration.publicKey && paymentIntegration.secretKey) {
        return { status: 'test', message: 'Test environment - Development mode' };
      } else {
        return { status: 'test_incomplete', message: 'Test environment - Missing configuration' };
      }
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, []);

  return {
    config,
    paymentIntegration,
    activeKeys,
    loading,
    saving,
    loadConfiguration,
    saveConfiguration,
    switchEnvironment,
    isProductionReady,
    getEnvironmentStatus,
  };
};