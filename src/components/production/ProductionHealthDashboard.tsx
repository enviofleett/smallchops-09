import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Activity, Database, CreditCard, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HealthMetrics {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  database: {
    connections: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  payments: {
    success_rate: number;
    recent_transactions: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  errors: {
    recent_count: number;
    status: 'healthy' | 'warning' | 'critical';
  };
}

export const ProductionHealthDashboard = () => {
  const [healthData, setHealthData] = useState<HealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchHealthData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_production_health_status');
      
      if (error) {
        console.error('Health check error:', error);
        toast({
          title: "Health Check Failed",
          description: "Unable to fetch system health status",
          variant: "destructive"
        });
        return;
      }

      setHealthData(data as unknown as HealthMetrics);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Health fetch error:', error);
      toast({
        title: "Connection Error", 
        description: "Failed to connect to health monitoring system",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      warning: 'secondary', 
      critical: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading && !healthData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Production Health Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading health status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6" />
              Production Health Dashboard
            </CardTitle>
            <div className="flex items-center gap-3">
              {healthData && getStatusBadge(healthData.status)}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchHealthData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Health Status Cards */}
      {healthData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Database Health */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="w-5 h-5" />
                Database
                {getStatusIcon(healthData.database.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Active Connections</span>
                    <span>{healthData.database.connections}</span>
                  </div>
                  <Progress 
                    value={Math.min((healthData.database.connections / 100) * 100, 100)} 
                    className="h-2"
                  />
                </div>
                <div className="text-center">
                  {getStatusBadge(healthData.database.status)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Health */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5" />
                Payments
                {getStatusIcon(healthData.payments.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Success Rate (24h)</span>
                    <span>{healthData.payments.success_rate}%</span>
                  </div>
                  <Progress 
                    value={healthData.payments.success_rate} 
                    className="h-2"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Recent transactions: {healthData.payments.recent_transactions}
                </div>
                <div className="text-center">
                  {getStatusBadge(healthData.payments.status)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Monitoring */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5" />
                Error Rate
                {getStatusIcon(healthData.errors.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {healthData.errors.recent_count}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Errors in last hour
                  </div>
                </div>
                <div className="text-center">
                  {getStatusBadge(healthData.errors.status)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Alerts */}
      {healthData && healthData.status !== 'healthy' && (
        <Alert variant={healthData.status === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {healthData.status === 'critical' && 
              "Critical system issues detected. Immediate attention required."
            }
            {healthData.status === 'warning' && 
              "System performance degraded. Monitoring recommended."
            }
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};