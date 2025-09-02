
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Clock, Mail, RefreshCw, Shield, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmailOperations } from '@/utils/emailOperations';

export const EmailManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailStats, setEmailStats] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const { toast } = useToast();

  // Load email statistics and health on mount
  useEffect(() => {
    loadEmailData();
  }, []);

  const loadEmailData = async () => {
    setIsLoading(true);
    try {
      // Load stats and health data in parallel
      const [statsResult, healthResult] = await Promise.all([
        EmailOperations.getEmailStats(),
        EmailOperations.checkEmailHealth()
      ]);

      if (statsResult.success) {
        setEmailStats(statsResult.data);
      }

      if (healthResult.success) {
        setHealthData(healthResult.data);
      }
    } catch (error) {
      console.error('Failed to load email data:', error);
      toast({
        title: "Error",
        description: "Failed to load email system data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Are you sure you want to clean up old email records? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await EmailOperations.triggerEmailCleanup(30);
      
      if (result.success) {
        toast({
          title: "Cleanup Completed",
          description: `Cleaned ${result.data?.events_cleaned || 0} events and ${result.data?.logs_cleaned || 0} logs`,
        });
        // Refresh data after cleanup
        loadEmailData();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to clean up email records",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testSmtpConnection = async () => {
    setIsLoading(true);
    try {
      const result = await EmailOperations.testEmailConnection();
      
      toast({
        title: result.success ? "SMTP Test Successful" : "SMTP Test Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "SMTP Test Error",
        description: error.message || "Failed to test SMTP connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent': return 'default';
      case 'failed': return 'destructive';
      case 'queued': return 'secondary';
      case 'processing': return 'outline';
      default: return 'secondary';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'unhealthy': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Health Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Email System Health
          </CardTitle>
          <CardDescription>
            Production-ready email monitoring and management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {healthData && getHealthIcon(healthData.health)}
              <div>
                <p className="font-medium">
                  System Status: {healthData?.health || 'Unknown'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last checked: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadEmailData}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={testSmtpConnection}
                disabled={isLoading}
              >
                <Mail className="h-4 w-4 mr-2" />
                Test SMTP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* System Checks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Database Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {healthData?.checks?.database === 'healthy' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm capitalize">
                    {healthData?.checks?.database || 'Unknown'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">SMTP Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {healthData?.checks?.smtp === 'healthy' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="text-sm capitalize">
                    {healthData?.checks?.smtp || 'Unknown'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Queue Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">
                    {emailStats?.by_status?.queued || 0} queued
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          {healthData?.stats?.last_24h && (
            <Card>
              <CardHeader>
                <CardTitle>Last 24 Hours Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {Object.entries(healthData.stats.last_24h).map(([status, count]) => (
                    <Badge key={status} variant={getStatusBadgeVariant(status)}>
                      {status}: {count as number}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          {emailStats && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Email Statistics (Last 7 Days)</CardTitle>
                  <CardDescription>
                    Total emails processed: {emailStats.total}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(emailStats.by_status).map(([status, count]) => (
                      <div key={status} className="text-center">
                        <div className="text-2xl font-bold">{count as number}</div>
                        <div className="text-sm text-muted-foreground capitalize">{status}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>By Priority</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(emailStats.by_priority).map(([priority, count]) => (
                        <div key={priority} className="flex justify-between">
                          <span className="capitalize">{priority}</span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Event Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {Object.entries(emailStats.by_event_type).map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="text-sm">{type}</span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Maintenance</CardTitle>
              <CardDescription>
                Admin-only operations for email system maintenance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Clean Up Old Records</h4>
                  <p className="text-sm text-muted-foreground">
                    Archive and remove email records older than 30 days
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCleanup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-2" />
                  )}
                  Run Cleanup
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">SMTP Health Check</h4>
                  <p className="text-sm text-muted-foreground">
                    Test SMTP connection and configuration
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={testSmtpConnection}
                  disabled={isLoading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
