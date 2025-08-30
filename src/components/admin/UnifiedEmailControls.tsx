import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  Send, 
  Activity, 
  RefreshCw,
  TestTube,
  AlertTriangle,
  Clock,
  Database,
  Mail,
  Server,
  Shield
} from 'lucide-react';

interface SMTPHealthCheck {
  configured: boolean;
  host?: string;
  port?: number;
  username?: string;
  error?: string;
}

interface EmailDeliveryStats {
  sent24h: number;
  failed24h: number;
  deliveryRate: number;
  topErrors: Array<{
    category: string;
    count: number;
    suggestion: string;
  }>;
}

export const UnifiedEmailControls = () => {
  const [smtpHealth, setSMTPHealth] = useState<SMTPHealthCheck | null>(null);
  const [deliveryStats, setDeliveryStats] = useState<EmailDeliveryStats | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // SMTP Health Check
  const checkSMTPHealth = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender?check=smtp', {
        method: 'GET',
        body: null
      });

      if (error) throw error;

      // Extract SMTP check from response
      const healthData = data;
      const smtpCheck = healthData.smtpCheck || { configured: false };
      
      setSMTPHealth(smtpCheck);
      setLastCheck(new Date());
    } catch (error: any) {
      setSMTPHealth({ configured: false, error: error.message });
      setLastCheck(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  // Load delivery statistics
  const loadDeliveryStats = async () => {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      // Get delivery stats from logs
      const { data: logs, error } = await supabase
        .from('smtp_delivery_logs')
        .select('delivery_status, error_message, metadata')
        .gte('created_at', cutoff.toISOString());

      if (error) throw error;

      const sent = logs?.filter(log => log.delivery_status === 'sent').length || 0;
      const failed = logs?.filter(log => log.delivery_status === 'failed').length || 0;
      const total = sent + failed;

      // Categorize errors
      const errorCounts: Record<string, { count: number; suggestion: string }> = {};
      logs?.filter(log => log.delivery_status === 'failed').forEach(log => {
        const metadata = log.metadata as any; // Type assertion for Json metadata
        const category = metadata?.error_category || 'unknown';
        const suggestion = metadata?.suggestion || 'Check configuration';
        
        if (!errorCounts[category]) {
          errorCounts[category] = { count: 0, suggestion };
        }
        errorCounts[category].count++;
      });

      const topErrors = Object.entries(errorCounts)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setDeliveryStats({
        sent24h: sent,
        failed24h: failed,
        deliveryRate: total > 0 ? Math.round((sent / total) * 100) : 100,
        topErrors
      });
    } catch (error) {
      console.error('Failed to load delivery stats:', error);
    }
  };

  // Requeue failed payment confirmations
  const requeueFailedConfirmations = async () => {
    try {
      setIsLoading(true);
      
      // Get failed payment confirmations from last 24h
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      const { data: failedLogs } = await supabase
        .from('smtp_delivery_logs')
        .select('recipient_email, template_key, metadata')
        .eq('delivery_status', 'failed')
        .eq('template_key', 'payment_confirmation')
        .gte('created_at', cutoff.toISOString());

      if (!failedLogs?.length) {
        toast.info('No failed payment confirmations to requeue');
        return;
      }

      // Create communication events for retry
      const events = failedLogs.map(log => ({
        recipient_email: log.recipient_email,
        event_type: 'payment_confirmation',
        template_key: 'payment_confirmation',
        status: 'queued' as const,
        variables: log.metadata || {},
        priority: 'high',
        email_type: 'transactional'
      }));

      const { error } = await supabase
        .from('communication_events')
        .insert(events);

      if (error) throw error;

      toast.success(`Requeued ${events.length} failed payment confirmations`);
      await loadDeliveryStats();
    } catch (error: any) {
      toast.error('Failed to requeue confirmations: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Test email with enhanced error reporting
  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          subject: 'SMTP System Test - ' + new Date().toISOString(),
          templateKey: 'smtp_test',
          variables: {
            test_time: new Date().toLocaleString(),
            business_name: 'Starters Small Chops'
          }
        }
      });

      if (error) {
        // Enhanced error reporting
        const errorMessage = typeof error === 'object' && error.message 
          ? error.message 
          : JSON.stringify(error);
        
        toast.error('Test failed: ' + errorMessage);
        return;
      }

      if (data?.success === false) {
        toast.error('Test failed: ' + data.error);
        return;
      }

      toast.success('Test email sent successfully! Check your inbox.');
      await loadDeliveryStats();
    } catch (error: any) {
      toast.error('Test failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh health on mount
  useEffect(() => {
    checkSMTPHealth();
    loadDeliveryStats();
  }, []);

  // Health status indicator
  const getHealthStatus = () => {
    if (!smtpHealth) return { status: 'loading', color: 'bg-gray-500', text: 'Checking...' };
    if (smtpHealth.error) return { status: 'error', color: 'bg-red-500', text: 'Error' };
    if (!smtpHealth.configured) return { status: 'warning', color: 'bg-yellow-500', text: 'Not Configured' };
    return { status: 'success', color: 'bg-green-500', text: 'Healthy' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Unified Email System
          </h3>
          <p className="text-sm text-muted-foreground">
            Centralized email management with health monitoring and admin controls
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={checkSMTPHealth} 
            disabled={isLoading} 
            variant="outline" 
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SMTP Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${healthStatus.color}`} />
                  <span className="text-sm font-medium">{healthStatus.text}</span>
                </div>
                {lastCheck && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last checked: {lastCheck.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">24h Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {deliveryStats?.deliveryRate || 0}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {deliveryStats?.sent24h || 0} sent, {deliveryStats?.failed24h || 0} failed
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Health</p>
                <div className="flex items-center gap-2 mt-1">
                  {healthStatus.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {healthStatus.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                  {healthStatus.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  <span className="text-sm font-medium">
                    {healthStatus.status === 'success' ? 'Operational' : 'Needs Attention'}
                  </span>
                </div>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Guidance */}
      {(!smtpHealth?.configured || smtpHealth?.error) && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>SMTP Configuration Required:</strong>
            {smtpHealth?.error ? (
              <span> Error: {smtpHealth.error}</span>
            ) : (
              <span> Please configure SMTP settings in the "SMTP Settings" tab to enable email delivery.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {smtpHealth?.configured && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Current Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>SMTP Host</Label>
                    <p className="text-sm font-mono">{smtpHealth.host}</p>
                  </div>
                  <div>
                    <Label>Port</Label>
                    <p className="text-sm font-mono">{smtpHealth.port}</p>
                  </div>
                  <div>
                    <Label>Username</Label>
                    <p className="text-sm font-mono">{smtpHealth.username}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge variant={healthStatus.status === 'success' ? 'default' : 'destructive'}>
                      {healthStatus.text}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Error Categories */}
          {deliveryStats?.topErrors && deliveryStats.topErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Top Error Categories (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deliveryStats.topErrors.map((error, index) => (
                    <div key={error.category} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{error.category}</p>
                        <p className="text-sm text-muted-foreground">{error.suggestion}</p>
                      </div>
                      <Badge variant="outline">{error.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Email Delivery
              </CardTitle>
              <CardDescription>
                Send a test email to verify your SMTP configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button 
                onClick={sendTestEmail} 
                disabled={isLoading || !testEmail || !smtpHealth?.configured}
                className="w-full"
              >
                <Mail className="mr-2 h-4 w-4" />
                {isLoading ? 'Sending Test Email...' : 'Send Test Email'}
              </Button>
              
              {!smtpHealth?.configured && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Configure SMTP settings first to enable email testing.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Admin Actions
              </CardTitle>
              <CardDescription>
                Administrative controls for email system management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={requeueFailedConfirmations}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Requeue Failed Payment Confirmations
              </Button>
              
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  This will retry sending payment confirmation emails that failed in the last 24 hours.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {deliveryStats && (
            <Card>
              <CardHeader>
                <CardTitle>24-Hour Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Delivery Rate</span>
                    <span className="font-medium">{deliveryStats.deliveryRate}%</span>
                  </div>
                  <Progress value={deliveryStats.deliveryRate} className="h-2" />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>Emails Sent:</span>
                      <span className="font-medium text-green-600">{deliveryStats.sent24h}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">{deliveryStats.failed24h}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};