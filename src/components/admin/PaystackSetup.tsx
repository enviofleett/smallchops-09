import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Settings, BarChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductionStatus {
  environment_check: {
    paystack_secret_configured: boolean;
    supabase_configured: boolean;
  };
  payment_metrics: {
    total_payments_24h: number;
    successful_payments_24h: number;
    payment_success_rate: string;
  };
  webhook_metrics: {
    total_webhooks_24h: number;
    processed_webhooks_24h: number;
    webhook_success_rate: string;
  };
  order_metrics: {
    total_orders_24h: number;
    paid_orders_24h: number;
    completed_orders_24h: number;
    order_completion_rate: string;
  };
  production_ready: boolean;
}

export const PaystackSetup: React.FC = () => {
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [setupChecks, setSetupChecks] = useState<any>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('production-paystack-setup', {
        body: { action: 'get_status' }
      });

      if (error) throw error;

      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
      toast.error('Failed to fetch production status');
    }
  };

  const verifySetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-paystack-setup', {
        body: { action: 'verify_setup' }
      });

      if (error) throw error;

      setSetupChecks(data);
      
      if (data.success) {
        toast.success('Setup verification passed');
      } else {
        toast.warning('Setup verification found issues');
      }
    } catch (error) {
      console.error('Error verifying setup:', error);
      toast.error('Failed to verify setup');
    } finally {
      setLoading(false);
    }
  };

  const configurePaystack = async () => {
    if (!secretKey.trim()) {
      toast.error('Please enter your Paystack secret key');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-paystack-setup', {
        body: { 
          action: 'configure_paystack',
          paystack_secret_key: secretKey.trim()
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Paystack configured successfully');
        setSecretKey('');
        await fetchStatus();
      } else {
        toast.error(data.error || 'Configuration failed');
      }
    } catch (error) {
      console.error('Error configuring Paystack:', error);
      toast.error('Failed to configure Paystack');
    } finally {
      setLoading(false);
    }
  };

  const fixOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-paystack-setup', {
        body: { action: 'fix_orders' }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Fixed ${data.results.linked_orders} orders and ${data.results.updated_statuses} statuses`);
        await fetchStatus();
      } else {
        toast.error(data.error || 'Fix failed');
      }
    } catch (error) {
      console.error('Error fixing orders:', error);
      toast.error('Failed to fix orders');
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon: React.FC<{ condition: boolean }> = ({ condition }) => {
    return condition ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Paystack Production Setup</h2>
          <p className="text-muted-foreground">Configure and monitor your Paystack integration</p>
        </div>
        <div className="flex items-center gap-2">
          {status?.production_ready ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-4 w-4 mr-1" />
              Production Ready
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Setup Required
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="setup">
            <Settings className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <BarChart className="h-4 w-4 mr-2" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Configure Paystack Secret Key</CardTitle>
              <CardDescription>
                Set up your Paystack secret key for webhook signature validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secret-key">Paystack Secret Key</Label>
                <Input
                  id="secret-key"
                  type="password"
                  placeholder="sk_test_... or sk_live_..."
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Find this in your Paystack Dashboard → Settings → API Keys
                </p>
              </div>
              
              <Button 
                onClick={configurePaystack}
                disabled={loading || !secretKey.trim()}
              >
                {loading ? 'Configuring...' : 'Configure Paystack'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Verify Environment Setup</CardTitle>
              <CardDescription>
                Check that all environment variables are properly configured
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {setupChecks && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Environment Variable Set</span>
                    <StatusIcon condition={setupChecks.checks.environment_variable} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Secret Key Format Valid</span>
                    <StatusIcon condition={setupChecks.checks.secret_key_format} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Paystack API Access</span>
                    <StatusIcon condition={setupChecks.checks.paystack_api_access} />
                  </div>
                </div>
              )}

              {setupChecks && !setupChecks.success && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Setup Issues Found:</strong>
                    <ul className="mt-2 list-disc list-inside">
                      {setupChecks.instructions.map((instruction: string, index: number) => (
                        <li key={index} className="text-sm">{instruction}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={verifySetup}
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Verifying...' : 'Verify Setup'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Fix Existing Data</CardTitle>
              <CardDescription>
                Link payment transactions to orders and update statuses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={fixOrders}
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Fixing...' : 'Fix Orders & Payments'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          {status && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Payment Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status.payment_metrics.payment_success_rate}</div>
                    <p className="text-xs text-muted-foreground">
                      {status.payment_metrics.successful_payments_24h} / {status.payment_metrics.total_payments_24h} (24h)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Webhook Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status.webhook_metrics.webhook_success_rate}</div>
                    <p className="text-xs text-muted-foreground">
                      {status.webhook_metrics.processed_webhooks_24h} / {status.webhook_metrics.total_webhooks_24h} (24h)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Order Completion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{status.order_metrics.order_completion_rate}</div>
                    <p className="text-xs text-muted-foreground">
                      {status.order_metrics.completed_orders_24h} / {status.order_metrics.total_orders_24h} (24h)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Environment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <StatusIcon condition={status.environment_check.paystack_secret_configured} />
                      <span className="text-sm">
                        {status.environment_check.paystack_secret_configured ? 'Configured' : 'Not Configured'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Environment Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Paystack Secret Key</span>
                      <StatusIcon condition={status.environment_check.paystack_secret_configured} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Supabase Integration</span>
                      <StatusIcon condition={status.environment_check.supabase_configured} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {status && !status.production_ready && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> Configure the missing PAYSTACK_SECRET_KEY environment variable in Supabase Edge Functions Secrets to enable webhook processing.
            <br />
            <a 
              href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              Go to Supabase Functions Secrets →
            </a>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};