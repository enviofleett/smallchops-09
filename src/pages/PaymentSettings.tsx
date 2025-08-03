import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PaymentAnalyticsDashboard } from '@/components/payments/PaymentAnalyticsDashboard';
import { TransactionMonitor } from '@/components/admin/TransactionMonitor';
import { PaymentHealthCheck } from '@/components/admin/PaymentHealthCheck';
import { EnvironmentSwitcher } from '@/components/environment/EnvironmentSwitcher';
import { PaymentErrorTracker } from '@/components/admin/PaymentErrorTracker';
import { PaystackProductionDashboard } from '@/components/payments/PaystackProductionDashboard';
import { LiveKeysConfiguration } from '@/components/payments/LiveKeysConfiguration';
import { ProductionTestingSuite } from '@/components/payments/ProductionTestingSuite';
import { ProductionMonitoring } from '@/components/payments/ProductionMonitoring';
import { AlertCircle, CheckCircle, Copy, ExternalLink, Lock, UserX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasPermission } from '@/hooks/usePermissions';

interface PaymentIntegration {
  id?: string;
  provider: string;
  public_key: string;
  secret_key: string;
  webhook_secret: string;
  test_mode: boolean;
  is_active?: boolean;
  currency: string;
  payment_methods: string[];
  connection_status?: string;
  live_public_key?: string;
  live_secret_key?: string;
  live_webhook_secret?: string;
}

export const PaymentSettings: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = useHasPermission('payment_settings', 'edit');
  
  const [config, setConfig] = useState<PaymentIntegration>({
    provider: 'paystack',
    public_key: '',
    secret_key: '',
    webhook_secret: '',
    test_mode: true,
    is_active: true,
    currency: 'NGN',
    payment_methods: ['card', 'bank_transfer', 'ussd']
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_integrations')
        .select('*')
        .eq('provider', 'paystack')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const paymentMethods = data.payment_methods || [];
        setConfig({
          id: data.id,
          provider: data.provider,
          public_key: data.public_key || '',
          secret_key: data.secret_key || '',
          webhook_secret: data.webhook_secret || '',
          test_mode: data.test_mode || true,
          is_active: true, // Simplified to avoid schema issues
          currency: data.currency || 'NGN',
          connection_status: data.connection_status || '',
          payment_methods: Array.isArray(paymentMethods) 
            ? paymentMethods as string[]
            : typeof paymentMethods === 'string' 
              ? [paymentMethods]
              : ['card']
        });
        setConnectionStatus(data.connection_status || '');
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast({
        title: "Error",
        description: "Failed to load payment configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    // Check authentication and authorization first
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save payment settings",
        variant: "destructive"
      });
      return;
    }

    if (!isAdmin) {
      toast({
        title: "Access Denied", 
        description: "You need admin permissions to save payment settings",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Validate required fields
      if (!config.public_key || !config.secret_key || !config.webhook_secret) {
        throw new Error('All fields are required');
      }

      const { error } = await supabase
        .from('payment_integrations')
        .upsert({
          ...config,
          connected_by: user?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'provider' });

      if (error) {
        // Provide specific error messages for common issues
        if (error.message.includes('row-level security')) {
          throw new Error('Access denied. You need admin permissions to modify payment settings.');
        } else if (error.message.includes('violates')) {
          throw new Error('Invalid data provided. Please check your input fields.');
        } else {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: "Payment configuration saved successfully",
      });

      setConnectionStatus('connected');
      
      // Reload configuration to sync with database
      await loadConfiguration();
    } catch (error: any) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      // Test connection by fetching banks
      const { data, error } = await supabase.functions.invoke('paystack-banks');

      if (error) throw error;

      if (data.status) {
        toast({
          title: "Success",
          description: "Paystack connection test successful",
        });
        setConnectionStatus('connected');
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Connection test failed: " + error.message,
        variant: "destructive"
      });
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/paystack`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">Not Connected</Badge>;
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Show authentication required state
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Payment Settings</h1>
            <p className="text-muted-foreground">Configure payment providers and manage transactions</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <UserX className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Authentication Required</h3>
                <p className="text-muted-foreground">Please log in to access payment settings</p>
              </div>
              <Button onClick={() => window.location.href = '/auth'}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show access denied state for non-admin users
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Payment Settings</h1>
            <p className="text-muted-foreground">Configure payment providers and manage transactions</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Admin Access Required</h3>
                <p className="text-muted-foreground">
                  You need administrator permissions to configure payment settings. 
                  Please contact your system administrator.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Logged in as: <span className="font-medium">{user?.email}</span> ({user?.role})
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payment Settings</h1>
          <p className="text-muted-foreground">Configure payment providers and manage transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {user?.email} ({user?.role})
          </Badge>
          {getConnectionStatusBadge()}
        </div>
      </div>

      <Tabs defaultValue="environment" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="live-keys">Live Keys</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="health">Health Check</TabsTrigger>
        </TabsList>

        <TabsContent value="environment" className="space-y-6">
          <EnvironmentSwitcher />
        </TabsContent>

        <TabsContent value="production" className="space-y-6">
          <PaystackProductionDashboard />
        </TabsContent>

        <TabsContent value="live-keys" className="space-y-6">
          <LiveKeysConfiguration />
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <ProductionTestingSuite />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <ProductionMonitoring />
        </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paystack Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Select
                    value={config.test_mode ? 'test' : 'live'}
                    onValueChange={(value) => setConfig({ ...config, test_mode: value === 'test' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test Mode</SelectItem>
                      <SelectItem value="live">Live Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={config.currency}
                    onValueChange={(value) => setConfig({ ...config, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">Nigerian Naira (NGN)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="GHS">Ghanaian Cedi (GHS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="public_key">Public Key</Label>
                <Input
                  id="public_key"
                  type="text"
                  value={config.public_key}
                  onChange={(e) => setConfig({ ...config, public_key: e.target.value })}
                  placeholder="pk_test_..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret_key">Secret Key</Label>
                <Input
                  id="secret_key"
                  type="password"
                  value={config.secret_key}
                  onChange={(e) => setConfig({ ...config, secret_key: e.target.value })}
                  placeholder="sk_test_..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_secret">Webhook Secret</Label>
                <Input
                  id="webhook_secret"
                  type="password"
                  value={config.webhook_secret}
                  onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                  placeholder="Webhook secret from Paystack dashboard"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Methods</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['card', 'bank_transfer', 'ussd', 'qr'].map((method) => (
                    <div key={method} className="flex items-center space-x-2">
                      <Switch
                        checked={config.payment_methods.includes(method)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setConfig({
                              ...config,
                              payment_methods: [...config.payment_methods, method]
                            });
                          } else {
                            setConfig({
                              ...config,
                              payment_methods: config.payment_methods.filter(m => m !== method)
                            });
                          }
                        }}
                      />
                      <Label className="capitalize">{method.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.is_active}
                  onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                />
                <Label>Enable Paystack Integration</Label>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={saveConfiguration}
                  disabled={saving || loading || !isAuthenticated || !isAdmin}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={!config.secret_key || testing || !isAuthenticated}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              
              {(!isAuthenticated || !isAdmin) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {!isAuthenticated 
                      ? "You must be logged in to save payment settings"
                      : "Administrator permissions required to modify payment settings"
                    }
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <PaymentAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionMonitor />
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <PaymentHealthCheck />
          <PaymentErrorTracker />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Configure this webhook URL in your Paystack dashboard to receive real-time payment notifications.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={`${window.location.origin}/api/webhooks/paystack`}
                    readOnly
                    className="bg-muted"
                  />
                  <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://dashboard.paystack.com/#/settings/developers', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Required Events</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['charge.success', 'charge.failed', 'charge.dispute.create', 'transfer.success', 'transfer.failed'].map((event) => (
                    <div key={event} className="flex items-center space-x-2 p-2 bg-muted rounded">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-mono">{event}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};