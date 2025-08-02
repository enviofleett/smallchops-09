import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Mail, 
  RefreshCw,
  Shield,
  TrendingUp,
  Zap
} from 'lucide-react';

interface EmailHealthMetrics {
  healthScore: number;
  totalSent: number;
  totalDelivered: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  failureRate: number;
  status: 'healthy' | 'warning' | 'critical';
  lastUpdated: string;
  recommendations: string[];
  issues: string[];
}

export const EmailHealthDashboard = () => {
  const [metrics, setMetrics] = useState<EmailHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchHealthMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('email-delivery-monitor', {
        body: { timeframe: '24h', detailed: true }
      });

      if (error) throw error;

      if (data.success) {
        const report = data.report;
        setMetrics({
          healthScore: report.healthScore,
          totalSent: report.totalSent,
          totalDelivered: report.totalDelivered,
          deliveryRate: report.deliveryRate,
          bounceRate: report.bounceRate,
          complaintRate: report.complaintRate,
          failureRate: report.totalSent > 0 ? ((report.totalSent - report.totalDelivered) / report.totalSent) * 100 : 0,
          status: report.healthScore >= 85 ? 'healthy' : report.healthScore >= 70 ? 'warning' : 'critical',
          lastUpdated: new Date().toISOString(),
          recommendations: report.recommendations || [],
          issues: report.issues || []
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to fetch health metrics: ${error.message}`,
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
      // Trigger production health monitor
      const { data, error } = await supabase.functions.invoke('email-production-monitor');
      
      if (error) throw error;
      
      toast({
        title: 'Health Check Complete',
        description: `System health score: ${data.healthScore || 'Unknown'}`,
      });
      
      // Refresh metrics after health check
      await fetchHealthMetrics();
    } catch (error: any) {
      toast({
        title: 'Health Check Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthMetrics();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealthMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading && !metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading email health metrics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Health Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Email System Health
            </CardTitle>
            <div className="flex gap-2">
              {metrics?.status && getStatusBadge(metrics.status)}
              <Button
                variant="outline"
                size="sm"
                onClick={triggerHealthCheck}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Checking...' : 'Health Check'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Health Score Circle */}
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <div className="w-full h-full rounded-full border-8 border-gray-200">
                  <div 
                    className={`absolute inset-0 rounded-full border-8 border-transparent ${
                      metrics?.status === 'healthy' ? 'border-green-500' :
                      metrics?.status === 'warning' ? 'border-yellow-500' : 'border-red-500'
                    }`}
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${50 + (metrics?.healthScore || 0) * 0.5}% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%)`
                    }}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{metrics?.healthScore || 0}</div>
                    <div className="text-sm text-muted-foreground">Health Score</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{metrics?.totalSent || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Sent</div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{metrics?.totalDelivered || 0}</div>
                  <div className="text-sm text-muted-foreground">Delivered</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Delivery Rate</span>
                  <span className="text-sm font-bold">{metrics?.deliveryRate?.toFixed(2) || 0}%</span>
                </div>
                <Progress value={metrics?.deliveryRate || 0} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Bounce Rate</span>
                  <span className="text-sm font-bold text-red-600">{metrics?.bounceRate?.toFixed(2) || 0}%</span>
                </div>
                <Progress value={metrics?.bounceRate || 0} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Issues */}
        {metrics?.issues && metrics.issues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Issues ({metrics.issues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.issues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-700">{issue}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {metrics?.recommendations && metrics.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <TrendingUp className="h-5 w-5" />
                Recommendations ({metrics.recommendations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-blue-700">{recommendation}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => supabase.functions.invoke('instant-email-processor')}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Process Queue
            </Button>
            
            <Button
              onClick={() => supabase.functions.invoke('automated-email-cron')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Run Maintenance
            </Button>
            
            <Button
              onClick={fetchHealthMetrics}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Metrics
            </Button>
          </div>
        </CardContent>
      </Card>

      {metrics?.lastUpdated && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
};