import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Activity,
  Database,
  Globe,
  Key,
  Webhook
} from 'lucide-react';

interface HealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
}

interface ProductionHealthData {
  overall_status: 'ready' | 'needs_attention' | 'not_ready';
  overall_message: string;
  summary: {
    healthy: number;
    warnings: number;
    critical: number;
    total_checks: number;
  };
  detailed_checks: HealthCheck[];
  recommendations: string[];
  timestamp: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'critical':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Activity className="h-5 w-5 text-gray-500" />;
  }
};

const getComponentIcon = (component: string) => {
  if (component.includes('Secret') || component.includes('Key')) {
    return <Key className="h-4 w-4" />;
  }
  if (component.includes('Webhook')) {
    return <Webhook className="h-4 w-4" />;
  }
  if (component.includes('Database')) {
    return <Database className="h-4 w-4" />;
  }
  if (component.includes('API') || component.includes('Connectivity')) {
    return <Globe className="h-4 w-4" />;
  }
  return <Activity className="h-4 w-4" />;
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'healthy':
      return 'default';
    case 'warning':
      return 'secondary';
    case 'critical':
      return 'destructive';
    default:
      return 'outline';
  }
};

export const PaystackProductionHealthDashboard: React.FC = () => {
  const [healthData, setHealthData] = useState<ProductionHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-production-health');

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setHealthData(data.production_readiness);
        toast({
          title: "Health Check Complete",
          description: "Production readiness assessment completed successfully",
        });
      } else {
        throw new Error(data.error || 'Health check failed');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: error instanceof Error ? error.message : "Failed to assess production readiness",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-600';
      case 'needs_attention':
        return 'text-yellow-600';
      case 'not_ready':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Paystack Production Health Check</CardTitle>
                <CardDescription>
                  Comprehensive assessment of production readiness for live payment processing
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={runHealthCheck} 
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Checking...' : 'Run Health Check'}</span>
            </Button>
          </div>
        </CardHeader>

        {healthData && (
          <CardContent className="space-y-6">
            {/* Overall Status */}
            <Alert className={healthData.overall_status === 'ready' ? 'border-green-200' : 
                              healthData.overall_status === 'needs_attention' ? 'border-yellow-200' : 'border-red-200'}>
              <div className="flex items-center space-x-2">
                {getStatusIcon(healthData.overall_status === 'ready' ? 'healthy' : 
                             healthData.overall_status === 'needs_attention' ? 'warning' : 'critical')}
                <AlertDescription className={`font-medium ${getOverallStatusColor(healthData.overall_status)}`}>
                  {healthData.overall_message}
                </AlertDescription>
              </div>
            </Alert>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{healthData.summary.healthy}</div>
                <div className="text-sm text-muted-foreground">Healthy</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{healthData.summary.warnings}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">{healthData.summary.critical}</div>
                <div className="text-sm text-muted-foreground">Critical</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{healthData.summary.total_checks}</div>
                <div className="text-sm text-muted-foreground">Total Checks</div>
              </div>
            </div>

            {/* Detailed Checks */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Component Health Status</h3>
              {healthData.detailed_checks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getComponentIcon(check.component)}
                    <div>
                      <div className="font-medium">{check.component}</div>
                      <div className="text-sm text-muted-foreground">{check.message}</div>
                      {check.details && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(check.details, null, 2).replace(/[{}",]/g, ' ').trim()}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(check.status)}>
                    {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {healthData.recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Recommendations</h3>
                <div className="space-y-2">
                  {healthData.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-muted rounded">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground text-right">
              Last checked: {new Date(healthData.timestamp).toLocaleString()}
            </div>
          </CardContent>
        )}

        {!healthData && (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Run Health Check" to assess production readiness</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};