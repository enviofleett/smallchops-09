import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useEnvironmentConfig } from '@/hooks/useEnvironmentConfig';
import { AlertTriangle, CheckCircle, Settings, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EnvironmentSwitcher: React.FC = () => {
  const {
    config,
    paymentIntegration,
    activeKeys,
    loading,
    saving,
    switchEnvironment,
    saveConfiguration,
    isProductionReady,
    getEnvironmentStatus,
  } = useEnvironmentConfig();

  const [formData, setFormData] = React.useState({
    paystackLivePublicKey: '',
    paystackLiveSecretKey: '',
    paystackTestPublicKey: '',
    paystackTestSecretKey: '',
    webhookUrl: '',
  });

  React.useEffect(() => {
    if (config && paymentIntegration) {
      setFormData({
        paystackLivePublicKey: paymentIntegration.livePublicKey || '',
        paystackLiveSecretKey: paymentIntegration.liveSecretKey || '',
        paystackTestPublicKey: paymentIntegration.publicKey || '',
        paystackTestSecretKey: paymentIntegration.secretKey || '',
        webhookUrl: config.webhookUrl || '',
      });
    }
  }, [config, paymentIntegration]);

  const handleSaveKeys = async () => {
    if (!config) return;

    const updatedConfig = {
      ...config,
      ...formData,
    };

    await saveConfiguration(updatedConfig);
  };

  const handleEnvironmentSwitch = async (isLive: boolean) => {
    if (isLive && !isProductionReady()) {
      return;
    }
    await switchEnvironment(isLive);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const envStatus = getEnvironmentStatus();

  return (
    <div className="space-y-6">
      {/* Current Environment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Current Environment
          </CardTitle>
          <CardDescription>
            Environment mode and configuration status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label>Environment Mode</Label>
                <Badge variant={config?.isLiveMode ? 'destructive' : 'secondary'}>
                  {config?.isLiveMode ? 'Live Production' : 'Test Development'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {envStatus.message}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {envStatus.status === 'live' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {envStatus.status.includes('incomplete') && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              {envStatus.status === 'not_configured' && <AlertTriangle className="h-5 w-5 text-red-500" />}
            </div>
          </div>

          {activeKeys && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Active Configuration</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Public Key</Label>
                  <p className="font-mono text-xs">
                    {activeKeys.publicKey ? `${activeKeys.publicKey.substring(0, 20)}...` : 'Not configured'}
                  </p>
                </div>
                <div>
                  <Label>Environment</Label>
                  <p>{activeKeys.environment}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="live-mode">Enable Live Mode</Label>
              <p className="text-sm text-muted-foreground">
                Switch to production environment with live payments
              </p>
            </div>
            <Switch
              id="live-mode"
              checked={config?.isLiveMode || false}
              onCheckedChange={handleEnvironmentSwitch}
              disabled={saving || (config?.isLiveMode === false && !isProductionReady())}
            />
          </div>

          {config?.isLiveMode === false && !isProductionReady() && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Configure live API keys below before enabling live mode.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* API Keys Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Keys Configuration
          </CardTitle>
          <CardDescription>
            Configure Paystack API keys for both test and live environments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Environment Keys */}
          <div className="space-y-4">
            <h4 className="font-medium">Test Environment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-public-key">Test Public Key</Label>
                <Input
                  id="test-public-key"
                  placeholder="pk_test_..."
                  value={formData.paystackTestPublicKey}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    paystackTestPublicKey: e.target.value 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-secret-key">Test Secret Key</Label>
                <Input
                  id="test-secret-key"
                  type="password"
                  placeholder="sk_test_..."
                  value={formData.paystackTestSecretKey}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    paystackTestSecretKey: e.target.value 
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Live Environment Keys */}
          <div className="space-y-4">
            <h4 className="font-medium">Live Environment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="live-public-key">Live Public Key</Label>
                <Input
                  id="live-public-key"
                  placeholder="pk_live_..."
                  value={formData.paystackLivePublicKey}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    paystackLivePublicKey: e.target.value 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="live-secret-key">Live Secret Key</Label>
                <Input
                  id="live-secret-key"
                  type="password"
                  placeholder="sk_live_..."
                  value={formData.paystackLiveSecretKey}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    paystackLiveSecretKey: e.target.value 
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://your-app.com/api/webhooks/paystack"
              value={formData.webhookUrl}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                webhookUrl: e.target.value 
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Configure this URL in your Paystack dashboard webhook settings
            </p>
          </div>

          <Button onClick={handleSaveKeys} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>

      {/* Production Readiness Checklist */}
      {!config?.isLiveMode && (
        <Card>
          <CardHeader>
            <CardTitle>Production Readiness Checklist</CardTitle>
            <CardDescription>
              Complete these items before enabling live mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {formData.paystackLivePublicKey ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                <span className="text-sm">Live public key configured</span>
              </div>
              <div className="flex items-center gap-2">
                {formData.paystackLiveSecretKey ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                <span className="text-sm">Live secret key configured</span>
              </div>
              <div className="flex items-center gap-2">
                {formData.webhookUrl ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                <span className="text-sm">Webhook URL configured</span>
              </div>
              <div className="flex items-center gap-2">
                {paymentIntegration?.connectionStatus === 'connected' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                <span className="text-sm">Payment integration connected</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};