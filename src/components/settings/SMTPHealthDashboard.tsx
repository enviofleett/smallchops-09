import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Mail,
  Server,
  Shield,
  BarChart3
} from 'lucide-react';

interface HealthMetric {
  id: string;
  provider_name: string;
  metric_type: string;
  metric_value: number;
  threshold_value?: number;
  threshold_breached: boolean;
  recorded_at: string;
}

interface ProviderHealth {
  name: string;
  health_score: number;
  is_active: boolean;
  last_health_check: string;
  consecutive_failures: number;
}

interface ReputationScore {
  domain: string;
  reputation_score: number;
  bounce_rate: number;
  complaint_rate: number;
  total_sent: number;
  status: string;
}

export const SMTPHealthDashboard = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [reputationScores, setReputationScores] = useState<ReputationScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchHealthData = async () => {
    try {
      // Fetch latest health metrics
      const { data: metrics } = await supabase
        .from('smtp_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);

      // Fetch provider health
      const { data: providers } = await supabase
        .from('smtp_provider_configs')
        .select('name, health_score, is_active, last_health_check, consecutive_failures')
        .eq('is_active', true);

      // Fetch reputation scores
      const { data: reputation } = await supabase
        .from('smtp_reputation_scores')
        .select('*')
        .order('last_updated', { ascending: false });

      setHealthMetrics(metrics || []);
      setProviderHealth(providers || []);
      setReputationScores(reputation || []);
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch SMTP health data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const triggerHealthCheck = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('smtp-health-monitor', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: 'Health Check Complete',
        description: 'SMTP health check completed successfully',
      });

      // Refresh data
      await fetchHealthData();
    } catch (error) {
      console.error('Error triggering health check:', error);
      toast({
        title: 'Health Check Failed',
        description: 'Failed to perform SMTP health check',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Set up real-time subscription for health metrics
    const subscription = supabase
      .channel('smtp_health_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'smtp_health_metrics'
      }, () => {
        fetchHealthData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getHealthStatusColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getHealthStatusIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-success" />;
    if (score >= 60) return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getReputationBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      warning: 'secondary',
      suspended: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status}
      </Badge>
    );
  };

  // Calculate overall system health
  const overallHealth = providerHealth.length > 0 
    ? Math.round(providerHealth.reduce((sum, p) => sum + p.health_score, 0) / providerHealth.length)
    : 0;

  // Get recent metrics by type
  const getRecentMetricValue = (type: string) => {
    const metric = healthMetrics.find(m => m.metric_type === type);
    return metric ? metric.metric_value : 0;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading SMTP health data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SMTP Health Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor your email delivery infrastructure and reputation
          </p>
        </div>
        <Button 
          onClick={triggerHealthCheck} 
          disabled={isRefreshing}
          variant="outline"
        >
          {isRefreshing ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Activity className="h-4 w-4 mr-2" />
          )}
          Run Health Check
        </Button>
      </div>

      {/* Overall Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            {getHealthStatusIcon(overallHealth)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallHealth}%</div>
            <Progress value={overallHealth} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getRecentMetricValue('bounce_rate').toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Target: &lt; 5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providerHealth.length}</div>
            <p className="text-xs text-muted-foreground">
              {providerHealth.filter(p => p.health_score >= 80).length} healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Domain Reputation</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reputationScores.filter(r => r.status === 'healthy').length}
            </div>
            <p className="text-xs text-muted-foreground">Healthy domains</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">Provider Health</TabsTrigger>
          <TabsTrigger value="reputation">Domain Reputation</TabsTrigger>
          <TabsTrigger value="metrics">Recent Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Provider Status</CardTitle>
              <CardDescription>
                Health scores and status of your SMTP providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {providerHealth.map((provider, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getHealthStatusIcon(provider.health_score)}
                      <div>
                        <h4 className="font-medium">{provider.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Last checked: {new Date(provider.last_health_check).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getHealthStatusColor(provider.health_score)}`}>
                        {provider.health_score}%
                      </div>
                      {provider.consecutive_failures > 0 && (
                        <p className="text-sm text-destructive">
                          {provider.consecutive_failures} consecutive failures
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reputation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domain Reputation Scores</CardTitle>
              <CardDescription>
                Sending reputation for your email domains
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reputationScores.map((score, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{score.domain}</h4>
                      <div className="flex space-x-4 text-sm text-muted-foreground">
                        <span>Bounce: {score.bounce_rate.toFixed(2)}%</span>
                        <span>Complaint: {score.complaint_rate.toFixed(2)}%</span>
                        <span>Sent: {score.total_sent}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="text-2xl font-bold">
                        {score.reputation_score}
                      </div>
                      {getReputationBadge(score.status)}
                    </div>
                  </div>
                ))}
                
                {reputationScores.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No reputation data available yet. Send some emails to build reputation history.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Health Metrics</CardTitle>
              <CardDescription>
                Latest performance and health metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthMetrics.slice(0, 10).map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{metric.provider_name}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="text-sm">{metric.metric_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono">
                        {metric.metric_value}
                        {metric.metric_type.includes('rate') && '%'}
                        {metric.metric_type.includes('time') && 'ms'}
                      </span>
                      {metric.threshold_breached && (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  </div>
                ))}
                
                {healthMetrics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics available. Run a health check to generate metrics.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alerts for Critical Issues */}
      {overallHealth < 50 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical:</strong> Overall SMTP health is below 50%. Immediate attention required to prevent email delivery issues.
          </AlertDescription>
        </Alert>
      )}

      {reputationScores.some(r => r.status === 'suspended') && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> One or more domains have suspended reputation status. Email delivery may be severely impacted.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};