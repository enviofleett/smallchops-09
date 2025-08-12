import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Clock,
  Zap,
  TrendingUp
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';

interface HealthMetrics {
  webhook_success_rate: number;
  total_webhooks_24h: number;
  failed_webhooks_24h: number;
  payment_success_rate: number;
  total_payments_24h: number;
  stuck_orders_count: number;
  last_webhook_received: string | null;
  avg_verification_time_ms: number;
}

interface StuckOrder {
  id: string;
  order_number: string;
  customer_email: string;
  total_amount: number;
  created_at: string;
  payment_reference: string;
}

export const PaymentHealthMonitor: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);

  // Fetch health metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['payment-health-metrics'],
    queryFn: async (): Promise<HealthMetrics> => {
      const { data, error } = await supabase.functions.invoke('payment-reconcile', {
        body: { action: 'health_metrics' }
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: autoRefresh ? 3 * 60 * 1000 : false // Reduced to 3 minutes when auto-refresh is on
  });

  // Fetch stuck orders
  const { data: stuckOrders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['stuck-orders'],
    queryFn: async (): Promise<StuckOrder[]> => {
      const { data, error } = await supabase.functions.invoke('payment-reconcile', {
        body: { action: 'scan_stuck_orders' }
      });

      if (error) throw error;
      return data.stuck_orders || [];
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false // Reduced to 5 minutes
  });

  // Auto-recovery function
  const runAutoRecovery = async () => {
    setIsRecovering(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-reconcile', {
        body: { action: 'auto_recover_stuck_orders' }
      });

      if (error) throw error;

      const recoveredCount = data.recovered_count || 0;
      if (recoveredCount > 0) {
        toast.success(`Successfully recovered ${recoveredCount} stuck orders`);
        refetchMetrics();
        refetchOrders();
      } else {
        toast.info('No stuck orders found to recover');
      }
    } catch (error) {
      console.error('Auto-recovery failed:', error);
      toast.error('Auto-recovery failed. Please try again.');
    } finally {
      setIsRecovering(false);
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    refetchMetrics();
    refetchOrders();
    toast.success('Payment health data refreshed');
  };

  const getHealthStatus = (rate: number) => {
    if (rate >= 95) return { status: 'excellent', color: 'text-green-500', icon: CheckCircle };
    if (rate >= 85) return { status: 'good', color: 'text-blue-500', icon: Activity };
    if (rate >= 70) return { status: 'warning', color: 'text-yellow-500', icon: AlertTriangle };
    return { status: 'critical', color: 'text-red-500', icon: XCircle };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const webhookHealth = metrics ? getHealthStatus(metrics.webhook_success_rate) : null;
  const paymentHealth = metrics ? getHealthStatus(metrics.payment_success_rate) : null;

  return (
    <>
      <Helmet>
        <title>Payment Health Monitor | Admin Dashboard</title>
        <meta name="description" content="Monitor Paystack payment system health and webhook status" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment Health Monitor</h1>
            <p className="text-muted-foreground">
              Real-time monitoring of Paystack payment system health
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={autoRefresh ? 'default' : 'secondary'}>
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Health Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhook Health</CardTitle>
              {webhookHealth && <webhookHealth.icon className={`h-4 w-4 ${webhookHealth.color}`} />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metricsLoading ? '...' : `${metrics?.webhook_success_rate.toFixed(1)}%`}
              </div>
              <p className="text-xs text-muted-foreground">
                {metricsLoading ? 'Loading...' : `${metrics?.total_webhooks_24h} webhooks (24h)`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Success</CardTitle>
              {paymentHealth && <paymentHealth.icon className={`h-4 w-4 ${paymentHealth.color}`} />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metricsLoading ? '...' : `${metrics?.payment_success_rate.toFixed(1)}%`}
              </div>
              <p className="text-xs text-muted-foreground">
                {metricsLoading ? 'Loading...' : `${metrics?.total_payments_24h} payments (24h)`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stuck Orders</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${(metrics?.stuck_orders_count || 0) > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metricsLoading ? '...' : metrics?.stuck_orders_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Orders pending payment confirmation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
              <Zap className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metricsLoading ? '...' : formatDuration(metrics?.avg_verification_time_ms || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Payment verification time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Critical Issues Alert */}
        {metrics && (metrics.webhook_success_rate < 85 || metrics.stuck_orders_count > 5) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical Payment Issues Detected!</strong>
              <br />
              {metrics.webhook_success_rate < 85 && (
                <span>Webhook success rate is critically low ({metrics.webhook_success_rate.toFixed(1)}%). </span>
              )}
              {metrics.stuck_orders_count > 5 && (
                <span>{metrics.stuck_orders_count} orders are stuck pending payment confirmation.</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Auto-Recovery Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Automated Recovery
            </CardTitle>
            <CardDescription>
              Automatically recover stuck orders and resolve payment inconsistencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {stuckOrders?.length || 0} orders ready for recovery
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last webhook: {metrics?.last_webhook_received 
                    ? new Date(metrics.last_webhook_received).toLocaleString() 
                    : 'Never'}
                </p>
              </div>
              <Button 
                onClick={runAutoRecovery} 
                disabled={isRecovering || (stuckOrders?.length || 0) === 0}
                className="flex items-center gap-2"
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Recovering...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Run Recovery
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stuck Orders Table */}
        {stuckOrders && stuckOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stuck Orders ({stuckOrders.length})</CardTitle>
              <CardDescription>
                Orders with successful payments but stuck in pending status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stuckOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{order.order_number}</Badge>
                        <span className="text-sm text-muted-foreground">{order.customer_email}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">{formatCurrency(order.total_amount)}</span>
                        <span className="text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Ref: {order.payment_reference}
                      </p>
                    </div>
                    <Badge variant="destructive">Stuck</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Real-time Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Webhook Processing</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Success Rate (24h):</span>
                    <span className={webhookHealth?.color}>
                      {metricsLoading ? '...' : `${metrics?.webhook_success_rate.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Webhooks:</span>
                    <span>{metricsLoading ? '...' : metrics?.failed_webhooks_24h}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Payment Processing</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Success Rate (24h):</span>
                    <span className={paymentHealth?.color}>
                      {metricsLoading ? '...' : `${metrics?.payment_success_rate.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Verification:</span>
                    <span>{metricsLoading ? '...' : formatDuration(metrics?.avg_verification_time_ms || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};