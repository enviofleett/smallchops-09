import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface HealthMetrics {
  uptime: number;
  successRate: number;
  averageResponseTime: number;
  transactionsLast24h: number;
  failuresLast24h: number;
  webhookStatus: 'healthy' | 'warning' | 'error';
  lastWebhookReceived: string | null;
}

interface SystemCheck {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  lastChecked: string;
}

export const PaymentHealthCheck: React.FC = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>({
    uptime: 99.9,
    successRate: 0,
    averageResponseTime: 0,
    transactionsLast24h: 0,
    failuresLast24h: 0,
    webhookStatus: 'healthy',
    lastWebhookReceived: null
  });
  const [systemChecks, setSystemChecks] = useState<SystemCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { toast } = useToast();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    performHealthCheck();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(performHealthCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  const performHealthCheck = async () => {
    setLoading(true);
    try {
      await Promise.all([
        checkTransactionMetrics(),
        checkSystemHealth(),
        checkWebhookStatus()
      ]);
      setLastRefresh(new Date());
    } catch (error) {
      handleError(error, 'performing health check');
    } finally {
      setLoading(false);
    }
  };

  const checkTransactionMetrics = async () => {
    try {
      // Get transactions from last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: transactions, error } = await supabase
        .from('payment_transactions')
        .select('status, created_at')
        .gte('created_at', twentyFourHoursAgo);

      if (error) throw error;

      const total = transactions?.length || 0;
      const successful = transactions?.filter(t => t.status === 'success').length || 0;
      const failed = transactions?.filter(t => t.status === 'failed').length || 0;
      const successRate = total > 0 ? (successful / total) * 100 : 100;

      setHealthMetrics(prev => ({
        ...prev,
        transactionsLast24h: total,
        failuresLast24h: failed,
        successRate: successRate
      }));
    } catch (error) {
      console.error('Transaction metrics check failed:', error);
    }
  };

  const checkSystemHealth = async () => {
    const checks: SystemCheck[] = [];
    const now = new Date().toISOString();

    try {
      // Check Paystack configuration
      const { data: config, error: configError } = await supabase
        .from('payment_integrations')
        .select('*')
        .eq('provider', 'paystack')
        .single();

      checks.push({
        name: 'Paystack Configuration',
        status: config && !configError ? 'pass' : 'fail',
        message: config && !configError
          ? 'Paystack integration is configured'
          : 'Paystack integration is not properly configured',
        lastChecked: now
      });

      // Check database connectivity
      const { error: dbError } = await supabase
        .from('payment_transactions')
        .select('id')
        .limit(1);

      checks.push({
        name: 'Database Connectivity',
        status: dbError ? 'fail' : 'pass',
        message: dbError ? 'Database connection failed' : 'Database is accessible',
        lastChecked: now
      });

      // Check recent transaction processing
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentTransactions, error: transactionError } = await supabase
        .from('payment_transactions')
        .select('status')
        .gte('created_at', oneHourAgo);

      const recentFailureRate = recentTransactions?.length > 0 
        ? (recentTransactions.filter(t => t.status === 'failed').length / recentTransactions.length) * 100
        : 0;

      checks.push({
        name: 'Transaction Processing',
        status: recentFailureRate > 10 ? 'warning' : recentFailureRate > 25 ? 'fail' : 'pass',
        message: `${recentFailureRate.toFixed(1)}% failure rate in the last hour`,
        lastChecked: now
      });

      // Check webhook logs
      const { data: webhookLogs, error: webhookError } = await supabase
        .from('webhook_logs')
        .select('created_at, processed')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      const unprocessedWebhooks = webhookLogs?.filter(w => !w.processed).length || 0;
      
      checks.push({
        name: 'Webhook Processing',
        status: unprocessedWebhooks > 5 ? 'warning' : unprocessedWebhooks > 10 ? 'fail' : 'pass',
        message: `${unprocessedWebhooks} unprocessed webhooks in the last hour`,
        lastChecked: now
      });

      setSystemChecks(checks);
    } catch (error) {
      console.error('System health check failed:', error);
    }
  };

  const checkWebhookStatus = async () => {
    try {
      const { data: latestWebhook, error } = await supabase
        .from('webhook_logs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const lastWebhookTime = latestWebhook?.created_at;
      let webhookStatus: 'healthy' | 'warning' | 'error' = 'healthy';

      if (lastWebhookTime) {
        const timeSinceLastWebhook = Date.now() - new Date(lastWebhookTime).getTime();
        const hoursSinceLastWebhook = timeSinceLastWebhook / (1000 * 60 * 60);

        if (hoursSinceLastWebhook > 24) {
          webhookStatus = 'error';
        } else if (hoursSinceLastWebhook > 6) {
          webhookStatus = 'warning';
        }
      } else {
        webhookStatus = 'warning';
      }

      setHealthMetrics(prev => ({
        ...prev,
        webhookStatus,
        lastWebhookReceived: lastWebhookTime
      }));
    } catch (error) {
      console.error('Webhook status check failed:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'fail':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'fail':
      case 'error':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const overallHealth = systemChecks.every(check => check.status === 'pass') 
    ? 'healthy' 
    : systemChecks.some(check => check.status === 'fail') 
    ? 'critical' 
    : 'warning';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Payment System Health</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of payment system performance
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {formatRelativeTime(lastRefresh.toISOString())}
          </div>
          <Button onClick={performHealthCheck} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      <Alert className={
        overallHealth === 'healthy' ? 'border-green-500' :
        overallHealth === 'warning' ? 'border-yellow-500' : 'border-red-500'
      }>
        {getStatusIcon(overallHealth)}
        <AlertDescription>
          <strong>System Status: </strong>
          {overallHealth === 'healthy' && 'All systems are operating normally'}
          {overallHealth === 'warning' && 'Some issues detected that require attention'}
          {overallHealth === 'critical' && 'Critical issues detected that need immediate attention'}
        </AlertDescription>
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Success Rate (24h)</p>
                <p className="text-2xl font-bold">{healthMetrics.successRate.toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={healthMetrics.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Transactions (24h)</p>
                <p className="text-2xl font-bold">{healthMetrics.transactionsLast24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Failures (24h)</p>
                <p className="text-2xl font-bold">{healthMetrics.failuresLast24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon(healthMetrics.webhookStatus)}
              <div>
                <p className="text-sm text-muted-foreground">Webhook Status</p>
                <div className="mt-1">{getStatusBadge(healthMetrics.webhookStatus)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Checks */}
      <Card>
        <CardHeader>
          <CardTitle>System Health Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(check.status)}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(check.lastChecked)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Details */}
      {healthMetrics.lastWebhookReceived && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last webhook received</p>
                <p className="font-medium">
                  {formatRelativeTime(healthMetrics.lastWebhookReceived)}
                </p>
              </div>
              {getStatusBadge(healthMetrics.webhookStatus)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};