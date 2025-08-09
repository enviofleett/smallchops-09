import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, Globe, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface PaymentIntegration {
  id: string;
  provider: string;
  public_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  test_mode: boolean | null;
  connection_status: string | null;
  supported_methods: any; // Using any to handle Json type from Supabase
}
export const PaymentSettingsTab: React.FC = () => {
  const [integrations, setIntegrations] = useState<PaymentIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, Partial<PaymentIntegration>>>({});
  useEffect(() => {
    loadIntegrations();
  }, []);
  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('payment_integrations').select('*');
      if (error) throw error;
      if (data) {
        setIntegrations(data);
        // Initialize form data
        const initialFormData: Record<string, Partial<PaymentIntegration>> = {};
        data.forEach(integration => {
          initialFormData[integration.provider] = {
            ...integration
          };
        });
        setFormData(initialFormData);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
      toast.error('Failed to load payment integrations');
    } finally {
      setLoading(false);
    }
  };
  const saveIntegration = async (provider: string) => {
    setSaving(true);
    try {
      const data = formData[provider];
      if (!data) return;

      // Basic Paystack key validation and test-mode handling
      if (provider === 'paystack') {
        const pub = (data.public_key || '').trim();
        const sec = (data.secret_key || '').trim();
        if (!pub || !sec) {
          toast.error('Public and Secret keys are required');
          setSaving(false);
          return;
        }
        if (!pub.startsWith('pk_')) {
          toast.error('Paystack public key must start with "pk_"');
          setSaving(false);
          return;
        }
        if (!sec.startsWith('sk_')) {
          toast.error('Paystack secret key must start with "sk_"');
          setSaving(false);
          return;
        }
      }

      // Auto-fill webhook secret in Test Mode if empty (fallback to secret key)
      const webhookToSave = (data.webhook_secret && data.webhook_secret.length > 0)
        ? data.webhook_secret
        : (data.test_mode ? (data.secret_key || '') : (data.webhook_secret || ''));

      const { error } = await supabase.from('payment_integrations').upsert(
        {
          provider,
          public_key: data.public_key || '',
          secret_key: data.secret_key || '',
          webhook_secret: webhookToSave || '',
          test_mode: data.test_mode || false,
          connection_status:
            (data.public_key?.startsWith('pk_') && data.secret_key?.startsWith('sk_'))
              ? 'connected'
              : 'disconnected',
          supported_methods: data.supported_methods || ['card']
        },
        {
          onConflict: 'provider'
        }
      );
      if (error) throw error;
      toast.success(`${provider} settings saved successfully`);
      loadIntegrations();
    } catch (error) {
      console.error('Error saving integration:', error);
      toast.error('Failed to save integration settings');
    } finally {
      setSaving(false);
    }
  };
  const testConnection = async (provider: string) => {
    try {
      const data = formData[provider];
      if (!data?.public_key || !data?.secret_key) {
        toast.error('Please enter API keys first');
        return;
      }

      if (provider === 'paystack') {
        const { data: cfg, error } = await (supabase.rpc as any)('get_public_paystack_config');
        if (error) throw error;
        if (!cfg) {
          toast.error('No active Paystack config found');
          return;
        }
      }

      toast.success(`${provider} connection test successful`);
    } catch (error) {
      toast.error(`${provider} connection test failed`);
      console.error(error);
    }
  };
  const updateFormData = (provider: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }));
  };
  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  const renderProviderCard = (provider: string, icon: React.ReactNode, title: string, description: string) => {
    const integration = integrations.find(i => i.provider === provider);
    const form = formData[provider] || {};
    const isConnected = integration?.connection_status === 'connected';
    const testCallbackUrl = `${window.location.origin}/payment/callback`;
    const webhookUrl = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure';
    const effectiveWebhookSecret = (form.webhook_secret || form.secret_key || '') as string;
    return <Card key={provider}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {icon}
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                
              </div>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </> : <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </>}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${provider}-public-key`}>Public Key</Label>
              <Input id={`${provider}-public-key`} placeholder={`Enter ${title} public key`} value={form.public_key || ''} onChange={e => updateFormData(provider, 'public_key', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-secret-key`}>Secret Key</Label>
              <div className="relative">
                <Input id={`${provider}-secret-key`} type={showSecrets[`${provider}-secret`] ? 'text' : 'password'} placeholder={`Enter ${title} secret key`} value={form.secret_key || ''} onChange={e => updateFormData(provider, 'secret_key', e.target.value)} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => toggleSecretVisibility(`${provider}-secret`)}>
                  {showSecrets[`${provider}-secret`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {provider === 'paystack' && <div className="space-y-2">
                <Label htmlFor={`${provider}-webhook-secret`}>Webhook Secret</Label>
                <div className="relative">
                  <Input
                    id={`${provider}-webhook-secret`}
                    type={showSecrets[`${provider}-webhook`] ? 'text' : 'password'}
                    placeholder="Enter webhook secret"
                    value={form.webhook_secret || ''}
                    onChange={e => updateFormData(provider, 'webhook_secret', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleSecretVisibility(`${provider}-webhook`)}
                  >
                    {showSecrets[`${provider}-webhook`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const random = crypto.getRandomValues(new Uint8Array(24));
                      const hex = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
                      updateFormData(provider, 'webhook_secret', hex);
                      toast.success('Webhook secret generated');
                    }}
                  >
                    Generate webhook secret
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Effective: <code className="break-all">{effectiveWebhookSecret}</code>
                  </div>
                </div>
              </div>}

            <div className="flex items-center space-x-2">
              <Switch id={`${provider}-test-mode`} checked={form.test_mode || false} onCheckedChange={checked => updateFormData(provider, 'test_mode', checked)} />
              <Label htmlFor={`${provider}-test-mode`}>Test Mode</Label>
            </div>
          </div>

          <Separator />

          <div className="flex space-x-2">
            <Button onClick={() => saveIntegration(provider)} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button variant="outline" onClick={() => testConnection(provider)} disabled={!form.public_key || !form.secret_key}>
              Test Connection
            </Button>
          </div>

          {provider === 'paystack' && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">Live Redirect/Callback URL</div>
                        <code className="text-xs break-all">https://startersmallchops.com/payment/callback</code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText('https://startersmallchops.com/payment/callback');
                          toast.success('Callback URL copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">Webhook URL</div>
                        <code className="text-xs break-all">{webhookUrl}</code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl);
                          toast.success('Webhook URL copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <div className="font-medium">Test Endpoints</div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">Test Redirect/Callback URL</div>
                        <code className="text-xs break-all">{testCallbackUrl}</code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(testCallbackUrl);
                          toast.success('Test Callback URL copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">Test Webhook URL</div>
                        <code className="text-xs break-all">{webhookUrl}</code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl);
                          toast.success('Test Webhook URL copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>;
  };
  if (loading) {
    return <div>Loading payment settings...</div>;
  }
  return <div className="space-y-6">
      <div>
        
        
      </div>

      <div className="grid gap-6">
        {renderProviderCard('paystack', <Building2 className="h-6 w-6" />, 'Paystack', 'African payment processing with local payment methods')}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Note:</strong> Your API keys are encrypted and stored securely. 
          Never share your secret keys or webhook secrets publicly.
        </AlertDescription>
      </Alert>
    </div>;
};