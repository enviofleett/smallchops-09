import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductionMetrics {
  webhook_success_rate: string;
  payment_success_rate: string;
  order_completion_rate: string;
  environment_configured: boolean;
  production_ready: boolean;
  last_24h_stats: {
    total_payments: number;
    successful_payments: number;
    total_webhooks: number;
    processed_webhooks: number;
    total_orders: number;
    completed_orders: number;
  };
}

export const ProductionStatus: React.FC = () => {
  const [metrics, setMetrics] = useState<ProductionMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-paystack-setup', {
        body: { action: 'get_status' }
      });

      if (error) throw error;

      if (data.success) {
        setMetrics({
          webhook_success_rate: data.status.webhook_metrics.webhook_success_rate,
          payment_success_rate: data.status.payment_metrics.payment_success_rate,
          order_completion_rate: data.status.order_metrics.order_completion_rate,
          environment_configured: data.status.environment_check.paystack_secret_configured,
          production_ready: data.status.production_ready,
          last_24h_stats: {
            total_payments: data.status.payment_metrics.total_payments_24h,
            successful_payments: data.status.payment_metrics.successful_payments_24h,
            total_webhooks: data.status.webhook_metrics.total_webhooks_24h,
            processed_webhooks: data.status.webhook_metrics.processed_webhooks_24h,
            total_orders: data.status.order_metrics.total_orders_24h,
            completed_orders: data.status.order_metrics.completed_orders_24h
          }
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to fetch production metrics');
    } finally {
      setLoading(false);
    }
  };

  const testEnvironment = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-paystack-setup', {
        body: { action: 'verify_setup' }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ All environment checks passed! System is production-ready.');
      } else {
        toast.error('❌ Environment checks failed. Please check configuration.');
      }
    } catch (error) {
      console.error('Error testing environment:', error);
      toast.error('Failed to test environment');
    } finally {
      setTesting(false);
    }
  };

  const StatusIcon: React.FC<{ condition: boolean }> = ({ condition }) => {
    return condition ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading production status...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Production Status</h2>
          <p className="text-muted-foreground">Real-time system health and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {metrics.production_ready ? (
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
            onClick={testEnvironment}
            disabled={testing}
          >
            <Zap className={`h-4 w-4 mr-2 ${testing ? 'animate-pulse' : ''}`} />
            {testing ? 'Testing...' : 'Test Environment'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {metrics.production_ready ? (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>System is Production Ready!</strong> All critical components are configured and functioning properly.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Configuration Issues Detected:</strong> Please ensure PAYSTACK_SECRET_KEY is properly configured in Supabase Edge Functions Secrets.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Payment Processing
              <StatusIcon condition={parseFloat(metrics.payment_success_rate) > 80} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.payment_success_rate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.last_24h_stats.successful_payments} / {metrics.last_24h_stats.total_payments} successful (24h)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: metrics.payment_success_rate }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Webhook Processing
              <StatusIcon condition={parseFloat(metrics.webhook_success_rate) > 90} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.webhook_success_rate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.last_24h_stats.processed_webhooks} / {metrics.last_24h_stats.total_webhooks} processed (24h)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: metrics.webhook_success_rate }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Order Completion
              <StatusIcon condition={parseFloat(metrics.order_completion_rate) > 70} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.order_completion_rate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.last_24h_stats.completed_orders} / {metrics.last_24h_stats.total_orders} completed (24h)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: metrics.order_completion_rate }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>Critical system components status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Paystack Secret Key</p>
                <p className="text-sm text-muted-foreground">Required for webhook signature validation</p>
              </div>
              <StatusIcon condition={metrics.environment_configured} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Webhook Processing</p>
                <p className="text-sm text-muted-foreground">Real-time payment event handling</p>
              </div>
              <StatusIcon condition={parseFloat(metrics.webhook_success_rate) > 80} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Payment Processing</p>
                <p className="text-sm text-muted-foreground">Secure transaction handling</p>
              </div>
              <StatusIcon condition={parseFloat(metrics.payment_success_rate) > 80} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Order Management</p>
                <p className="text-sm text-muted-foreground">End-to-end order lifecycle</p>
              </div>
              <StatusIcon condition={parseFloat(metrics.order_completion_rate) > 70} />
            </div>
          </div>
        </CardContent>
      </Card>

      {metrics.production_ready && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-green-700">🎉 System Ready for Production</CardTitle>
            <CardDescription>
              Your Paystack integration is fully configured and operational
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">✅ Environment variables configured</p>
              <p className="text-sm">✅ Webhook processing functional</p>
              <p className="text-sm">✅ Payment processing operational</p>
              <p className="text-sm">✅ Order management system active</p>
              <p className="text-sm">✅ Real-time notifications enabled</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};