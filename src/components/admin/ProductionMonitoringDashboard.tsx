import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Server,
  Database,
  Zap
} from 'lucide-react';

interface SystemHealthMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_type: string;
  severity: string;
  recorded_at: string;
  tags: any;
}

interface SecurityAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  source_ip?: string | null;
}

interface PerformanceMetric {
  id: string;
  endpoint: string;
  method: string;
  response_time_ms: number;
  status_code: number;
  recorded_at: string;
  error_details?: any;
}

export const ProductionMonitoringDashboard = () => {
  const [healthMetrics, setHealthMetrics] = useState<SystemHealthMetric[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadMonitoringData = async () => {
    setIsLoading(true);
    try {
      // Load health metrics
      const { data: healthData, error: healthError } = await supabase
        .from('system_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (healthError) throw healthError;
      setHealthMetrics((healthData || []).map(item => ({
        ...item,
        tags: item.tags || {}
      })));

      // Load security alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertsError) throw alertsError;
      setSecurityAlerts((alertsData || []).map(item => ({
        ...item,
        source_ip: item.source_ip as string | null
      })));

      // Load performance metrics
      const { data: perfData, error: perfError } = await supabase
        .from('performance_analytics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (perfError) throw perfError;
      setPerformanceMetrics((perfData || []).map(item => ({
        ...item,
        error_details: item.error_details || {}
      })));

    } catch (error: any) {
      console.error('Error loading monitoring data:', error);
      toast({
        title: "Error loading monitoring data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runSecurityCheck = async () => {
    try {
      const { data, error } = await supabase.rpc('enhanced_security_check');
      
      if (error) throw error;
      
      const result = data as { security_score: number; status: string };
      toast({
        title: "Security Check Complete",
        description: `Security Score: ${result.security_score}/100 (${result.status})`,
        variant: result.security_score >= 75 ? "default" : "destructive"
      });
      
      // Reload data to show new metrics
      loadMonitoringData();
    } catch (error: any) {
      toast({
        title: "Security check failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Manually resolved from dashboard'
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alert resolved",
        description: "Security alert has been marked as resolved"
      });

      loadMonitoringData();
    } catch (error: any) {
      toast({
        title: "Error resolving alert",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadMonitoringData();
    
    // Set up real-time subscriptions
    const healthSubscription = supabase
      .channel('health_metrics')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'system_health_metrics' 
      }, loadMonitoringData)
      .subscribe();

    const alertsSubscription = supabase
      .channel('security_alerts')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'security_alerts' 
      }, loadMonitoringData)
      .subscribe();

    return () => {
      healthSubscription.unsubscribe();
      alertsSubscription.unsubscribe();
    };
  }, []);

  const getHealthStatusColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'destructive';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const averageResponseTime = performanceMetrics.length > 0 
    ? Math.round(performanceMetrics.reduce((sum, m) => sum + m.response_time_ms, 0) / performanceMetrics.length)
    : 0;

  const errorRate = performanceMetrics.length > 0
    ? Math.round((performanceMetrics.filter(m => m.status_code >= 400).length / performanceMetrics.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Production Monitoring</h1>
          <p className="text-muted-foreground">Real-time system health and security monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runSecurityCheck} variant="outline">
            <Shield className="h-4 w-4 mr-2" />
            Run Security Check
          </Button>
          <Button onClick={loadMonitoringData} variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {healthMetrics.filter(m => m.severity === 'info').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Healthy metrics recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {securityAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Open security alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageResponseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Last 100 requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last 100 requests
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Security Alerts</CardTitle>
              <CardDescription>
                Critical security events requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active security alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {securityAlerts.map((alert) => (
                    <Alert key={alert.id} className="border-l-4 border-l-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{alert.title}</span>
                              <Badge variant="destructive">{alert.severity}</Badge>
                              <Badge variant="outline">{alert.alert_type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {alert.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.created_at).toLocaleString()}
                              {alert.source_ip && ` • IP: ${alert.source_ip}`}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health Metrics</CardTitle>
              <CardDescription>
                Real-time system performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthMetrics.slice(0, 10).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getSeverityIcon(metric.severity)}
                      <div>
                        <div className="font-medium">{metric.metric_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(metric.recorded_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{metric.metric_value}</span>
                      <Badge variant={getHealthStatusColor(metric.severity)}>
                        {metric.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Performance</CardTitle>
              <CardDescription>
                Recent API response times and error rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceMetrics.slice(0, 20).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4" />
                      <div>
                        <div className="font-medium">
                          {metric.method} {metric.endpoint}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(metric.recorded_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{metric.response_time_ms}ms</span>
                      <Badge variant={metric.status_code >= 400 ? "destructive" : "default"}>
                        {metric.status_code}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};