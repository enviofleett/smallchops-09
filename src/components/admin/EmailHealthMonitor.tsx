import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailHealthStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  timestamp: string;
  details?: any;
}

interface EmailMetrics {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  avgDeliveryTime: number;
  recentErrors: any[];
}

const EmailHealthMonitor: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<EmailHealthStatus>({
    status: 'healthy',
    message: 'Checking...',
    timestamp: new Date().toISOString()
  });
  const [metrics, setMetrics] = useState<EmailMetrics>({
    totalSent: 0,
    totalFailed: 0,
    successRate: 0,
    avgDeliveryTime: 0,
    recentErrors: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { toast } = useToast();

  const runHealthCheck = async () => {
    setIsLoading(true);
    try {
      // Test SMTP configuration
      const { data: smtpConfig, error: smtpError } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('use_smtp', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (smtpError) {
        setHealthStatus({
          status: 'error',
          message: 'Failed to fetch SMTP configuration',
          timestamp: new Date().toISOString(),
          details: smtpError
        });
        return;
      }

      if (!smtpConfig) {
        setHealthStatus({
          status: 'error',
          message: 'No SMTP configuration found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validate SMTP settings
      const missingFields = [];
      if (!smtpConfig.smtp_host) missingFields.push('Host');
      if (!smtpConfig.smtp_user) missingFields.push('Username');
      if (!smtpConfig.smtp_pass) missingFields.push('Password');
      if (!smtpConfig.sender_email) missingFields.push('Sender Email');

      if (missingFields.length > 0) {
        setHealthStatus({
          status: 'error',
          message: `SMTP configuration incomplete: Missing ${missingFields.join(', ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Test email processor function
      const { data: testResult, error: testError } = await supabase.functions.invoke(
        'production-email-processor',
        {
          body: {
            recipient: { email: 'health-check@test.com' },
            subject: 'Health Check Test',
            html: '<p>This is a health check test email.</p>',
            text: 'This is a health check test email.',
            dryRun: true // Add dry run flag to prevent actual sending
          }
        }
      );

      if (testError) {
        setHealthStatus({
          status: 'warning',
          message: `Email processor test failed: ${testError.message}`,
          timestamp: new Date().toISOString(),
          details: testError
        });
        return;
      }

      // Check recent email metrics
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentDeliveries, error: metricsError } = await supabase
        .from('email_delivery_logs')
        .select('*')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false });

      if (!metricsError && recentDeliveries) {
        const sent = recentDeliveries.filter(d => d.delivery_status === 'sent').length;
        const failed = recentDeliveries.filter(d => d.delivery_status === 'failed').length;
        const total = sent + failed;
        const successRate = total > 0 ? (sent / total) * 100 : 100;

        setMetrics({
          totalSent: sent,
          totalFailed: failed,
          successRate,
          avgDeliveryTime: 0, // Calculate if you have timing data
          recentErrors: recentDeliveries.filter(d => d.delivery_status === 'failed').slice(0, 5)
        });

        if (successRate < 90) {
          setHealthStatus({
            status: 'warning',
            message: `Email success rate is ${successRate.toFixed(1)}% (last 24h)`,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      setHealthStatus({
        status: 'healthy',
        message: 'All email systems operational',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      setHealthStatus({
        status: 'error',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        details: error
      });
    } finally {
      setIsLoading(false);
      setLastCheck(new Date());
    }
  };

  const sendTestEmail = async () => {
    const testEmail = prompt('Enter email address for test:');
    if (!testEmail) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-email-processor', {
        body: {
          recipient: { email: testEmail },
          subject: 'Email System Test',
          html: `
            <h2>Email System Test</h2>
            <p>This is a test email from the Starters Small Chops email system.</p>
            <p>Sent at: ${new Date().toLocaleString()}</p>
            <p>If you received this email, the system is working correctly!</p>
          `,
          text: `Email System Test - This is a test email sent at ${new Date().toLocaleString()}`,
          emailType: 'test'
        }
      });

      if (error) {
        toast({
          title: 'Test Email Failed',
          description: error.message,
          variant: 'destructive'
        });
      } else if (data?.success) {
        toast({
          title: 'Test Email Sent',
          description: `Test email sent successfully to ${testEmail}`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Test Email Failed',
          description: data?.error || 'Unknown error occurred',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Test Email Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(runHealthCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (healthStatus.status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (healthStatus.status) {
      case 'healthy':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Email System Health Monitor</h2>
        <div className="flex gap-2">
          <Button
            onClick={runHealthCheck}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={sendTestEmail}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Test Email
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {getStatusIcon()}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge()}
              <p className="text-xs text-muted-foreground">
                Last checked: {lastCheck?.toLocaleTimeString() || 'Never'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate (24h)</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalSent} sent, {metrics.totalFailed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent (24h)</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSent}</div>
            <p className="text-xs text-muted-foreground">
              Successfully delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Emails (24h)</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.totalFailed}</div>
            <p className="text-xs text-muted-foreground">
              Delivery failures
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className={
            healthStatus.status === 'healthy' ? 'border-green-200 bg-green-50' :
            healthStatus.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
            'border-red-200 bg-red-50'
          }>
            <AlertDescription className="flex items-center gap-2">
              {getStatusIcon()}
              <span>{healthStatus.message}</span>
            </AlertDescription>
          </Alert>
          
          {healthStatus.details && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Error Details:</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(healthStatus.details, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {metrics.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.recentErrors.map((error, index) => (
                <div key={index} className="border p-3 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{error.recipient_email}</p>
                      <p className="text-sm text-gray-600">{error.subject}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {error.delivery_status}
                    </Badge>
                  </div>
                  {error.smtp_response && (
                    <p className="text-xs text-gray-500 mt-1">{error.smtp_response}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(error.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmailHealthMonitor;