import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Copy, ExternalLink, Key, Shield } from 'lucide-react';

interface LiveKeysConfig {
  live_public_key: string;
  live_secret_key: string;
  live_webhook_secret: string;
  is_live_mode: boolean;
}

export function LiveKeysConfiguration() {
  const [config, setConfig] = useState<LiveKeysConfig>({
    live_public_key: '',
    live_secret_key: '',
    live_webhook_secret: '',
    is_live_mode: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadLiveKeys();
  }, []);

  const loadLiveKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_integrations')
        .select('live_public_key, live_secret_key, live_webhook_secret')
        .eq('provider', 'paystack')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          live_public_key: data.live_public_key || '',
          live_secret_key: data.live_secret_key || '',
          live_webhook_secret: data.live_webhook_secret || '',
          is_live_mode: false
        });
      }

      // Check current environment
      const { data: envData } = await supabase
        .from('environment_config')
        .select('is_live_mode')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (envData) {
        setConfig(prev => ({ ...prev, is_live_mode: envData.is_live_mode }));
      }
    } catch (error) {
      console.error('Error loading live keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLiveKeys = async () => {
    setSaving(true);
    try {
      // Validate keys format
      if (config.live_public_key && !config.live_public_key.startsWith('pk_live_')) {
        throw new Error('Live public key must start with pk_live_');
      }
      if (config.live_secret_key && !config.live_secret_key.startsWith('sk_live_')) {
        throw new Error('Live secret key must start with sk_live_');
      }

      // Update payment integration
      const { error } = await supabase
        .from('payment_integrations')
        .update({
          live_public_key: config.live_public_key,
          live_secret_key: config.live_secret_key,
          live_webhook_secret: config.live_webhook_secret,
          updated_at: new Date().toISOString()
        })
        .eq('provider', 'paystack');

      if (error) throw error;

      toast({
        title: "Success",
        description: "Live API keys saved successfully",
      });

      setConnectionStatus('configured');
    } catch (error: any) {
      console.error('Error saving live keys:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save live keys",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const testLiveConnection = async () => {
    if (!config.live_secret_key) {
      toast({
        title: "Error",
        description: "Live secret key is required for testing",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      // Test with live keys by temporarily switching environment
      const { data, error } = await supabase.functions.invoke('paystack-banks', {
        body: { use_live_keys: true }
      });

      if (error) throw error;

      if (data.status) {
        toast({
          title: "Success",
          description: "Live Paystack connection test successful",
        });
        setConnectionStatus('connected');
      } else {
        throw new Error('Live connection test failed');
      }
    } catch (error: any) {
      console.error('Live connection test failed:', error);
      toast({
        title: "Error",
        description: "Live connection test failed: " + error.message,
        variant: "destructive"
      });
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const switchToLiveMode = async () => {
    if (!config.live_public_key || !config.live_secret_key || !config.live_webhook_secret) {
      toast({
        title: "Error",
        description: "All live keys must be configured before switching to live mode",
        variant: "destructive"
      });
      return;
    }

    try {
      // Update environment configuration
      const { error } = await supabase
        .from('environment_config')
        .upsert({
          environment: 'production',
          is_live_mode: true,
          webhook_url: 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setConfig(prev => ({ ...prev, is_live_mode: true }));
      
      toast({
        title: "Success",
        description: "Switched to live mode successfully",
      });
    } catch (error: any) {
      console.error('Error switching to live mode:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to switch to live mode",
        variant: "destructive"
      });
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure';
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Production webhook URL copied to clipboard",
    });
  };

  const getKeysStatus = () => {
    const hasAllKeys = config.live_public_key && config.live_secret_key && config.live_webhook_secret;
    if (!hasAllKeys) return 'incomplete';
    if (connectionStatus === 'connected') return 'verified';
    if (connectionStatus === 'configured') return 'configured';
    return 'unverified';
  };

  const getStatusBadge = () => {
    const status = getKeysStatus();
    const badges = {
      incomplete: <Badge variant="destructive">Incomplete</Badge>,
      unverified: <Badge variant="secondary">Unverified</Badge>,
      configured: <Badge variant="outline">Configured</Badge>,
      verified: <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>
    };
    return badges[status];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Live API Keys Configuration
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure your production Paystack API keys for live transactions
              </p>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Security Notice</p>
                <p>Live API keys are for production use only. Never share them or commit them to version control.</p>
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => window.open('https://dashboard.paystack.com/#/settings/developers', '_blank')}
                >
                  Get your live keys from Paystack Dashboard <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="live_public_key">Live Public Key</Label>
              <Input
                id="live_public_key"
                type="text"
                value={config.live_public_key}
                onChange={(e) => setConfig({ ...config, live_public_key: e.target.value })}
                placeholder="pk_live_..."
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Starts with pk_live_ and is safe to use in frontend applications
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="live_secret_key">Live Secret Key</Label>
              <Input
                id="live_secret_key"
                type="password"
                value={config.live_secret_key}
                onChange={(e) => setConfig({ ...config, live_secret_key: e.target.value })}
                placeholder="sk_live_..."
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Starts with sk_live_ and must be kept secure on the server
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="live_webhook_secret">Live Webhook Secret</Label>
              <Input
                id="live_webhook_secret"
                type="password"
                value={config.live_webhook_secret}
                onChange={(e) => setConfig({ ...config, live_webhook_secret: e.target.value })}
                placeholder="Enter webhook secret from Paystack dashboard"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Used to verify webhook signatures for security
              </p>
            </div>

            <div className="space-y-2">
              <Label>Production Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value="https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure"
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWebhookUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this URL in your Paystack dashboard webhook settings
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={saveLiveKeys}
              disabled={saving || loading}
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Save Live Keys'}
            </Button>
            <Button
              variant="outline"
              onClick={testLiveConnection}
              disabled={!config.live_secret_key || testing}
            >
              {testing ? 'Testing...' : 'Test Live Connection'}
            </Button>
          </div>

          {getKeysStatus() === 'verified' && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Switch to Live Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Enable live payments with real transactions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.is_live_mode}
                    onCheckedChange={switchToLiveMode}
                    disabled={getKeysStatus() !== 'verified'}
                  />
                  <Label>Live Mode</Label>
                </div>
              </div>
              
              {!config.is_live_mode && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You are currently in test mode. Switch to live mode to process real payments.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}