import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Mail, 
  TrendingUp,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

interface DeliveryMetrics {
  totalSent: number;
  failed24h: number;
  deliveryRate: number;
  queuedCount: number;
  processingCount: number;
  recentFailures: Array<{
    recipient_email: string;
    error_message: string;
    template_key: string;
    created_at: string;
  }>;
}

export const EmailStatusDashboard = () => {
  const [metrics, setMetrics] = useState<DeliveryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDeliveryMetrics = async () => {
    try {
      setIsLoading(true);
      
      // Get metrics from last 24 hours
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      // Delivery logs for sent/failed counts
      const { data: deliveryLogs } = await supabase
        .from('smtp_delivery_logs')
        .select('delivery_status, recipient_email, error_message, template_key, created_at')
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false });

      // Communication events for queue status
      const { data: queueStatus } = await supabase
        .from('communication_events')
        .select('status')
        .in('status', ['queued', 'processing']);

      const sent = deliveryLogs?.filter(log => log.delivery_status === 'sent').length || 0;
      const failed = deliveryLogs?.filter(log => log.delivery_status === 'failed').length || 0;
      const total = sent + failed;

      const queued = queueStatus?.filter(event => event.status === 'queued').length || 0;
      const processing = queueStatus?.filter(event => event.status === 'processing').length || 0;

      const recentFailures = deliveryLogs?.filter(log => log.delivery_status === 'failed')
        .slice(0, 5)
        .map(log => ({
          recipient_email: log.recipient_email,
          error_message: log.error_message || 'Unknown error',
          template_key: log.template_key || 'unknown',
          created_at: log.created_at
        })) || [];

      setMetrics({
        totalSent: sent,
        failed24h: failed,
        deliveryRate: total > 0 ? Math.round((sent / total) * 100) : 100,
        queuedCount: queued,
        processingCount: processing,
        recentFailures
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load delivery metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveryMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDeliveryMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = () => {
    if (!metrics) return { color: 'bg-gray-500', text: 'Loading...', variant: 'secondary' as const };
    
    if (metrics.deliveryRate >= 95) {
      return { color: 'bg-green-500', text: 'Excellent', variant: 'default' as const };
    } else if (metrics.deliveryRate >= 85) {
      return { color: 'bg-yellow-500', text: 'Good', variant: 'secondary' as const };
    } else {
      return { color: 'bg-red-500', text: 'Needs Attention', variant: 'destructive' as const };
    }
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Email System Status
          </h3>
          <p className="text-sm text-muted-foreground">
            Live monitoring of email delivery performance and queue status
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lastUpdated && (
            <>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${healthStatus.color}`} />
                  <span className="text-2xl font-bold">{metrics?.deliveryRate || 0}%</span>
                </div>
                <Badge variant={healthStatus.variant} className="mt-1">
                  {healthStatus.text}
                </Badge>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Emails Sent (24h)</p>
                <p className="text-2xl font-bold text-green-600">{metrics?.totalSent || 0}</p>
                <p className="text-xs text-muted-foreground">Successfully delivered</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed (24h)</p>
                <p className="text-2xl font-bold text-red-600">{metrics?.failed24h || 0}</p>
                <p className="text-xs text-muted-foreground">Delivery failures</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queue Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold">{metrics?.queuedCount || 0}</span>
                  <span className="text-sm text-muted-foreground">queued</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{metrics?.processingCount || 0}</span>
                  <span className="text-xs text-muted-foreground">processing</span>
                </div>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Rate Progress */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              24-Hour Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Overall Delivery Rate</span>
                <span className="font-medium">{metrics.deliveryRate}%</span>
              </div>
              <Progress value={metrics.deliveryRate} className="h-3" />
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-medium text-green-600">{metrics.totalSent}</div>
                  <div className="text-muted-foreground">Delivered</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-red-600">{metrics.failed24h}</div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-blue-600">{metrics.queuedCount}</div>
                  <div className="text-muted-foreground">Queued</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Failures */}
      {metrics?.recentFailures && metrics.recentFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Failures
            </CardTitle>
            <CardDescription>
              Last {metrics.recentFailures.length} email delivery failures
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentFailures.map((failure, index) => (
                <Alert key={index} className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <strong>Recipient:</strong> {failure.recipient_email}
                      </div>
                      <div>
                        <strong>Template:</strong> {failure.template_key}
                      </div>
                      <div className="col-span-2">
                        <strong>Error:</strong> {failure.error_message}
                      </div>
                      <div className="col-span-2 text-xs text-red-600">
                        {new Date(failure.created_at).toLocaleString()}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Health Alert */}
      {metrics && metrics.deliveryRate < 85 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Performance Alert:</strong> Email delivery rate is below 85%. 
            Please check SMTP configuration and recent error logs for issues that need attention.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};