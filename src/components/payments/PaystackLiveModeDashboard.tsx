import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { usePaystackConfig } from '@/hooks/usePaystackConfig';
import { toast } from '@/hooks/use-toast';
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Globe,
  Key,
  Webhook,
  Activity,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ProductionStatus {
  isLive: boolean;
  lastHealthCheck: string;
  successRate: number;
  totalTransactions: number;
  issues: string[];
  warnings: string[];
  webhookStatus: 'active' | 'inactive' | 'error';
  keyValidation: {
    publicKey: boolean;
    secretKey: boolean;
    webhookSecret: boolean;
  };
}

export const PaystackLiveModeDashboard: React.FC = () => {
  const { config, loading: configLoading } = usePaystackConfig();
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthChecking, setHealthChecking] = useState(false);

  const loadProductionStatus = async () => {
    try {
      setLoading(true);
      
      // Get production health status
      const { data: healthData, error: healthError } = await supabase.functions.invoke(
        'paystack-production-health',
        { method: 'GET' }
      );

      if (healthError) {
        console.error('Health check error:', healthError);
        throw new Error('Failed to load production health status');
      }

      // Get environment configuration
      const { data: envData, error: envError } = await supabase
        .from('environment_config')
        .select('*')
        .single();

      if (envError && envError.code !== 'PGRST116') {
        console.error('Environment config error:', envError);
      }

      // Get payment integrations
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_integrations')
        .select('*')
        .eq('provider', 'paystack')
        .single();

      if (paymentError && paymentError.code !== 'PGRST116') {
        console.error('Payment integration error:', paymentError);
      }

      const isLive = envData?.is_live_mode || false;
      const paymentLive = paymentData?.environment === 'live';

      setStatus({
        isLive: isLive && paymentLive,
        lastHealthCheck: healthData?.last_check || new Date().toISOString(),
        successRate: healthData?.success_rate || 0,
        totalTransactions: healthData?.total_transactions || 0,
        issues: healthData?.issues || [],
        warnings: healthData?.warnings || [],
        webhookStatus: healthData?.webhook_status || 'inactive',
        keyValidation: {
          publicKey: Boolean(config?.publicKey?.startsWith('pk_live_')),
          secretKey: healthData?.secret_key_valid || false,
          webhookSecret: healthData?.webhook_secret_valid || false
        }
      });

    } catch (error) {
      console.error('Failed to load production status:', error);
      toast({
        title: "Status Load Error",
        description: "Failed to load production status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    try {
      setHealthChecking(true);
      
      const { data, error } = await supabase.functions.invoke(
        'paystack-production-health',
        { 
          method: 'POST',
          body: { action: 'health_check' }
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Health Check Complete",
        description: "Production health check completed successfully.",
        variant: "default",
      });

      // Reload status after health check
      await loadProductionStatus();

    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: "Failed to run production health check.",
        variant: "destructive",
      });
    } finally {
      setHealthChecking(false);
    }
  };

  useEffect(() => {
    loadProductionStatus();
  }, []);

  if (loading || configLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Production Dashboard
          </CardTitle>
          <CardDescription>Loading production status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusBadge = () => {
    if (!status?.isLive) {
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Test Mode</Badge>;
    }
    
    const hasIssues = status.issues.length > 0;
    const hasWarnings = status.warnings.length > 0;
    
    if (hasIssues) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Live - Issues</Badge>;
    }
    
    if (hasWarnings) {
      return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Live - Warnings</Badge>;
    }
    
    return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Live - Healthy</Badge>;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Production Status
            </div>
            {getStatusBadge()}
          </CardTitle>
          <CardDescription>
            Current environment and system health overview
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {status?.isLive ? 'LIVE' : 'TEST'}
              </div>
              <div className="text-sm text-muted-foreground">Environment</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${getSuccessRateColor(status?.successRate || 0)}`}>
                {status?.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {status?.totalTransactions.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Transactions</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Last health check: {status?.lastHealthCheck ? new Date(status.lastHealthCheck).toLocaleString() : 'Never'}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runHealthCheck}
              disabled={healthChecking}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${healthChecking ? 'animate-spin' : ''}`} />
              {healthChecking ? 'Checking...' : 'Run Health Check'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configuration Status
          </CardTitle>
          <CardDescription>
            API keys and webhook configuration validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <span>Live Public Key</span>
              </div>
              <div className="flex items-center gap-2">
                {status?.keyValidation.publicKey ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  {status?.keyValidation.publicKey ? 'Valid' : 'Invalid/Missing'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Live Secret Key</span>
              </div>
              <div className="flex items-center gap-2">
                {status?.keyValidation.secretKey ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  {status?.keyValidation.secretKey ? 'Valid' : 'Invalid/Missing'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                <span>Webhook Configuration</span>
              </div>
              <div className="flex items-center gap-2">
                {status?.webhookStatus === 'active' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm capitalize">
                  {status?.webhookStatus || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues and Warnings */}
      {(status?.issues.length > 0 || status?.warnings.length > 0) && (
        <div className="space-y-4">
          {status?.issues.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Critical Issues:</div>
                <ul className="list-disc list-inside space-y-1">
                  {status.issues.map((issue, index) => (
                    <li key={index} className="text-sm">{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {status?.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Warnings:</div>
                <ul className="list-disc list-inside space-y-1">
                  {status.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Webhook URL Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure this URL in your Paystack Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-muted rounded-lg font-mono text-sm">
            https://oknnklksdiqaifhxaccs.functions.supabase.co/paystack-webhook-secure
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Add this URL to your Paystack Dashboard under Settings → Webhooks for live transactions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};