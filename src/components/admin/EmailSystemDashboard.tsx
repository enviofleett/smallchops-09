import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Shield,
  Settings,
  Activity,
  BarChart3,
  AlertCircle
} from 'lucide-react';

interface EmailMetrics {
  totalSent: number;
  delivered: number;
  bounced: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  bounceRate: number;
  healthScore: number;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  lastCheck: string;
}

export const EmailSystemDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('email-delivery-monitor', {
        body: { timeframe: '24h' }
      });

      if (error) throw error;

      if (data.success) {
        setMetrics(data.report);
      }
    } catch (error: any) {
      console.error('Error fetching email metrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch email metrics",
        variant: "destructive",
      });
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('email-health-monitor');

      if (error) throw error;

      setHealth(data);
    } catch (error: any) {
      console.error('Error fetching health status:', error);
    }
  };

  const processQueue = async (priority: 'high' | 'all' = 'all') => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('instant-email-processor', {
        body: { priority }
      });

      if (error) throw error;

      toast({
        title: "Queue Processing Complete",
        description: `Processed ${data.processed || 0} emails`,
      });

      await fetchMetrics();
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message || 'Failed to process email queue',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const testSMTP = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: 'admin@example.com',
          subject: 'SMTP Connection Test',
          emailType: 'transactional',
          textContent: 'This is a test email to verify SMTP connectivity.'
        }
      });

      if (error) throw error;

      toast({
        title: "SMTP Test",
        description: "Test email sent successfully",
      });
    } catch (error: any) {
      toast({
        title: "SMTP Test Failed",
        description: error.message || 'SMTP connection test failed',
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMetrics(), fetchHealthStatus()]);
      setIsLoading(false);
    };

    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'warning': return 'text-warning';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading email system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email System Dashboard</h2>
          <p className="text-muted-foreground">Monitor and manage email delivery system</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={testSMTP} 
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Test SMTP
          </Button>
          <Button 
            onClick={() => processQueue('high')} 
            disabled={isProcessing}
            size="sm"
          >
            <Mail className="h-4 w-4 mr-2" />
            Process Queue
          </Button>
        </div>
      </div>

      {/* System Health Alert */}
      {health && health.status !== 'healthy' && (
        <Alert variant={health.status === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Email system health: <strong>{health.status}</strong>
            {health.issues.length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {health.issues.slice(0, 3).map((issue, index) => (
                  <li key={index} className="text-sm">{issue}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="processing">Queue Processing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {metrics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalSent.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.deliveryRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.delivered} delivered
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.bounceRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.bounced} bounced
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.healthScore}/100</div>
                  <p className="text-xs text-muted-foreground">
                    System health rating
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {health && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className={getHealthColor(health.status)}>
                      {getHealthIcon(health.status)}
                    </span>
                    System Status
                  </CardTitle>
                  <CardDescription>
                    Overall email system health: <Badge variant={health.status === 'healthy' ? 'default' : 'destructive'}>
                      {health.status}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Last checked: {new Date(health.lastCheck).toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Issues</CardTitle>
                  <CardDescription>
                    Issues requiring attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {health.issues.length > 0 ? (
                    <ul className="space-y-2">
                      {health.issues.map((issue, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                          <span className="text-sm">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active issues</p>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>
                    Suggested actions to improve system health
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {health.recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {health.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recommendations at this time</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="processing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Queue Management</CardTitle>
                <CardDescription>
                  Process pending emails and manage the queue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => processQueue('high')} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Process High Priority
                </Button>
                <Button 
                  onClick={() => processQueue('all')} 
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Process All Queued
                </Button>
                {metrics && (
                  <div className="text-center pt-4">
                    <p className="text-sm text-muted-foreground">
                      {metrics.pending} emails pending
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Actions</CardTitle>
                <CardDescription>
                  Administrative actions for email system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={testSMTP}
                  variant="outline"
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Test SMTP Connection
                </Button>
                <Button 
                  onClick={fetchHealthStatus}
                  variant="outline"
                  className="w-full"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Run Health Check
                </Button>
                <Button 
                  onClick={fetchMetrics}
                  variant="outline"
                  className="w-full"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Refresh Metrics
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Analytics</CardTitle>
              <CardDescription>
                Detailed email delivery statistics and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-success">{metrics.delivered}</div>
                    <div className="text-sm text-muted-foreground">Delivered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-warning">{metrics.bounced}</div>
                    <div className="text-sm text-muted-foreground">Bounced</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-destructive">{metrics.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No analytics data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};