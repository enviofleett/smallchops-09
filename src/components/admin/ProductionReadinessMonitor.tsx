import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Mail, 
  Users, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Zap,
  TrendingUp
} from 'lucide-react';

interface ProductionMetrics {
  health_score: number;
  status: string;
  metrics: {
    registration: {
      success_rate: number;
      total_attempts: number;
      successful: number;
      failed: number;
      status: string;
    };
    email_delivery: {
      delivery_rate: number;
      immediate_processing_rate: number;
      total_events: number;
      sent: number;
      failed: number;
      queued: number;
      status: string;
    };
    processing: {
      processor_health: number;
      healthy_processors: number;
      total_processors: number;
      status: string;
    };
    system: {
      uptime_percentage: number;
      critical_errors: number;
      status: string;
    };
  };
  recommendations: string[];
  auto_recovery_triggered: boolean;
  timestamp: string;
}

export const ProductionReadinessMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<ProductionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase.functions.invoke('email-production-monitor');
      
      if (error) {
        throw new Error(error.message);
      }
      
      setMetrics(data);
      setLastUpdated(new Date().toLocaleTimeString());
      
      if (data.auto_recovery_triggered) {
        toast({
          title: "Auto-Recovery Triggered",
          description: "System automatically initiated recovery procedures due to performance issues.",
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      console.error('Error fetching production metrics:', error);
      toast({
        title: "Monitoring Error",
        description: `Failed to fetch production metrics: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const triggerImmediateProcessing = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('instant-email-processor');
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({
        title: "Email Processing Triggered",
        description: `Processed ${data.successful || 0} emails immediately.`,
      });
      
      // Refresh metrics after processing
      setTimeout(fetchMetrics, 2000);
      
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: `Failed to trigger email processing: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-4 w-4" />;
      case 'good': return <TrendingUp className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Readiness Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading production metrics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Readiness Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load production metrics. Please check system health.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Production Health Score
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMetrics}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={triggerImmediateProcessing}
              >
                <Zap className="h-4 w-4 mr-1" />
                Process Emails
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(metrics.status)} text-white`}>
                    {getStatusIcon(metrics.status)}
                    {metrics.status.toUpperCase()}
                  </Badge>
                  <span className="text-2xl font-bold">{metrics.health_score}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated}
                </p>
              </div>
              <div className="w-32">
                <Progress value={metrics.health_score} className="h-3" />
              </div>
            </div>
            
            {metrics.auto_recovery_triggered && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Auto-recovery was triggered due to performance issues. System is working to restore optimal performance.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Registration Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Registration Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {metrics.metrics.registration.success_rate}%
                </span>
                <Badge variant={metrics.metrics.registration.status === 'excellent' ? 'default' : 'destructive'}>
                  {metrics.metrics.registration.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.metrics.registration.successful}/{metrics.metrics.registration.total_attempts} successful
              </div>
              <Progress value={metrics.metrics.registration.success_rate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Email Delivery */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Delivery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {metrics.metrics.email_delivery.delivery_rate}%
                </span>
                <Badge variant={metrics.metrics.email_delivery.status === 'excellent' ? 'default' : 'destructive'}>
                  {metrics.metrics.email_delivery.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.metrics.email_delivery.sent}/{metrics.metrics.email_delivery.total_events} delivered
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.metrics.email_delivery.queued} queued, {metrics.metrics.email_delivery.immediate_processing_rate}% immediate
              </div>
              <Progress value={metrics.metrics.email_delivery.delivery_rate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Processing Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Processing Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {metrics.metrics.processing.processor_health}%
                </span>
                <Badge variant={metrics.metrics.processing.status === 'excellent' ? 'default' : 'destructive'}>
                  {metrics.metrics.processing.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.metrics.processing.healthy_processors}/{metrics.metrics.processing.total_processors} processors healthy
              </div>
              <Progress value={metrics.metrics.processing.processor_health} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* System Uptime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              System Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {metrics.metrics.system.uptime_percentage}%
                </span>
                <Badge variant={metrics.metrics.system.status === 'excellent' ? 'default' : 'destructive'}>
                  {metrics.metrics.system.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.metrics.system.critical_errors} critical errors
              </div>
              <Progress value={metrics.metrics.system.uptime_percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {metrics.recommendations && metrics.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Production Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.recommendations.map((recommendation, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};