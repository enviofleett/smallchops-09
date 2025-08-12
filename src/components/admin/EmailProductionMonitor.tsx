import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useEmailDeliveryTracking } from '@/hooks/useEmailDeliveryTracking';
import { useEmailAutomation } from '@/hooks/useEmailAutomation';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Server,
  Users,
  ShoppingCart,
  Bell
} from 'lucide-react';

interface SystemMetrics {
  totalEmailsToday: number;
  deliveryRate: number;
  bounceRate: number;
  avgProcessingTime: number;
  queueSize: number;
  failedEmailsCount: number;
  lastProcessedAt: string;
}

interface EmailTypeStats {
  welcome: number;
  orderConfirmation: number;
  orderStatus: number;
  passwordReset: number;
  admin: number;
}

export const EmailProductionMonitor = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    totalEmailsToday: 0,
    deliveryRate: 0,
    bounceRate: 0,
    avgProcessingTime: 0,
    queueSize: 0,
    failedEmailsCount: 0,
    lastProcessedAt: ''
  });

  const [emailTypeStats, setEmailTypeStats] = useState<EmailTypeStats>({
    welcome: 0,
    orderConfirmation: 0,
    orderStatus: 0,
    passwordReset: 0,
    admin: 0
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  const { toast } = useToast();
  const { emailStats, deliveryLogs, retryFailedEmail } = useEmailDeliveryTracking();
  const { processEmailQueue, getEmailQueueStatus } = useEmailAutomation();

  // Fetch comprehensive system metrics
  const fetchSystemMetrics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's email stats
      const { data: todayEvents, error: eventsError } = await supabase
        .from('communication_events')
        .select('status, event_type, created_at, sent_at, processed_at')
        .gte('created_at', today.toISOString());

      if (eventsError) throw eventsError;

      // Get queue status
      const queueStatus = await getEmailQueueStatus();

      // Calculate metrics
      const totalEmails = todayEvents.length;
      const sentEmails = todayEvents.filter(e => e.status === 'sent').length;
      const failedEmails = todayEvents.filter(e => e.status === 'failed').length;
      
      const deliveryRate = totalEmails > 0 ? (sentEmails / totalEmails) * 100 : 0;
      
      // Calculate average processing time
      const processedEmails = todayEvents.filter(e => e.sent_at && e.created_at);
      const avgProcessingTime = processedEmails.length > 0 
        ? processedEmails.reduce((acc, email) => {
            const created = new Date(email.created_at).getTime();
            const sent = new Date(email.sent_at).getTime();
            return acc + (sent - created);
          }, 0) / processedEmails.length / 1000 // Convert to seconds
        : 0;

      // Get last processed timestamp
      const lastProcessed = todayEvents
        .filter(e => e.processed_at)
        .sort((a, b) => new Date(b.processed_at).getTime() - new Date(a.processed_at).getTime())[0];

      setSystemMetrics({
        totalEmailsToday: totalEmails,
        deliveryRate,
        bounceRate: emailStats.bounce_rate,
        avgProcessingTime,
        queueSize: queueStatus.total,
        failedEmailsCount: failedEmails,
        lastProcessedAt: lastProcessed?.processed_at || ''
      });

      // Calculate email type stats
      const typeStats = todayEvents.reduce((acc, email) => {
        switch (email.event_type) {
          case 'customer_welcome':
            acc.welcome++;
            break;
          case 'order_confirmation':
            acc.orderConfirmation++;
            break;
          case 'order_status_update':
          case 'order_shipped':
          case 'order_delivered':
            acc.orderStatus++;
            break;
          case 'password_reset':
            acc.passwordReset++;
            break;
          case 'admin_new_order':
            acc.admin++;
            break;
        }
        return acc;
      }, {
        welcome: 0,
        orderConfirmation: 0,
        orderStatus: 0,
        passwordReset: 0,
        admin: 0
      });

      setEmailTypeStats(typeStats);
      setLastRefresh(new Date());

    } catch (error: any) {
      console.error('Failed to fetch system metrics:', error);
      toast({
        title: 'Metrics Error',
        description: `Failed to load system metrics: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  // Auto-refresh metrics
  useEffect(() => {
    fetchSystemMetrics();
    
    const interval = setInterval(fetchSystemMetrics, 5 * 60 * 1000); // Reduced frequency to 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  const handleProcessQueue = async () => {
    setIsMonitoring(true);
    try {
      const result = await processEmailQueue();
      
      toast({
        title: 'Queue Processed',
        description: `Processed ${result.processed} emails: ${result.success} sent, ${result.failed} failed`,
      });

      // Refresh metrics after processing
      await fetchSystemMetrics();

    } catch (error: any) {
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsMonitoring(false);
    }
  };

  const getHealthStatus = () => {
    if (systemMetrics.deliveryRate >= 95) return { status: 'healthy', color: 'text-green-600', bg: 'bg-green-100' };
    if (systemMetrics.deliveryRate >= 85) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { status: 'critical', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const health = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Production Email System Monitor
            <Badge className={`${health.bg} ${health.color}`}>
              {health.status.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Emails Today</span>
              </div>
              <div className="text-2xl font-bold">{systemMetrics.totalEmailsToday}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Delivery Rate</span>
              </div>
              <div className="text-2xl font-bold">{systemMetrics.deliveryRate.toFixed(1)}%</div>
              <Progress value={systemMetrics.deliveryRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Queue Size</span>
              </div>
              <div className="text-2xl font-bold">{systemMetrics.queueSize}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Failed Today</span>
              </div>
              <div className="text-2xl font-bold">{systemMetrics.failedEmailsCount}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleProcessQueue} 
                disabled={isMonitoring}
                className="flex items-center gap-2"
              >
                {isMonitoring ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Server className="h-4 w-4" />
                )}
                {isMonitoring ? 'Processing...' : 'Process Queue'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={fetchSystemMetrics}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Welcome</span>
            </div>
            <div className="text-xl font-bold mt-2">{emailTypeStats.welcome}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Orders</span>
            </div>
            <div className="text-xl font-bold mt-2">{emailTypeStats.orderConfirmation}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Status Updates</span>
            </div>
            <div className="text-xl font-bold mt-2">{emailTypeStats.orderStatus}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Password Reset</span>
            </div>
            <div className="text-xl font-bold mt-2">{emailTypeStats.passwordReset}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Admin Alerts</span>
            </div>
            <div className="text-xl font-bold mt-2">{emailTypeStats.admin}</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Processing Time</span>
                <span className="text-sm">{systemMetrics.avgProcessingTime.toFixed(1)}s</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Bounce Rate</span>
                <span className="text-sm">{systemMetrics.bounceRate.toFixed(2)}%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Processed</span>
                <span className="text-sm">
                  {systemMetrics.lastProcessedAt 
                    ? new Date(systemMetrics.lastProcessedAt).toLocaleTimeString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Failed Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {deliveryLogs
                .filter(log => log.delivery_status === 'failed')
                .slice(0, 5)
                .map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <div>
                      <div className="text-sm font-medium">{log.recipient_email}</div>
                      <div className="text-xs text-muted-foreground">{log.error_message}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retryFailedEmail(log.id)}
                      className="text-xs"
                    >
                      Retry
                    </Button>
                  </div>
                ))}
              {deliveryLogs.filter(log => log.delivery_status === 'failed').length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  No failed emails
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Alerts */}
      {(systemMetrics.queueSize > 100 || systemMetrics.deliveryRate < 90) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemMetrics.queueSize > 100 && (
                <div className="flex items-center gap-2 text-orange-700">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">High queue size detected: {systemMetrics.queueSize} emails pending</span>
                </div>
              )}
              {systemMetrics.deliveryRate < 90 && (
                <div className="flex items-center gap-2 text-orange-700">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm">Low delivery rate: {systemMetrics.deliveryRate.toFixed(1)}% (below 90% threshold)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};