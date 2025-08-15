import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface HealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
}

interface HealthCheckResponse {
  overall_status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  checks: HealthCheck[];
  summary: {
    total_checks: number;
    healthy: number;
    warnings: number;
    critical: number;
  };
  production_ready: boolean;
  recommendations: string[];
}

export const ProductionReadinessChecker = () => {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('production-health-check');
      
      if (error) throw error;
      
      setHealthData(data);
      
      if (data.production_ready) {
        toast({
          title: "System Ready! 🚀",
          description: "Your system is ready for production launch",
        });
      } else {
        toast({
          title: "Issues Found",
          description: "Critical issues need to be resolved before launch",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: "Unable to run production health check",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-success text-success-foreground">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Production Readiness Check
          </CardTitle>
          <CardDescription>
            Verify that your system is ready for production launch
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runHealthCheck} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Health Check...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Production Health Check
              </>
            )}
          </Button>

          {healthData && (
            <div className="space-y-4 mt-6">
              {/* Overall Status */}
              <Card className={`border-2 ${
                healthData.production_ready 
                  ? 'border-success bg-success/5' 
                  : 'border-destructive bg-destructive/5'
              }`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(healthData.overall_status)}
                      <div>
                        <h3 className="font-semibold">
                          {healthData.production_ready ? 'Ready for Production' : 'Issues Detected'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Last checked: {new Date(healthData.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(healthData.overall_status)}
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">{healthData.summary.total_checks}</div>
                    <div className="text-sm text-muted-foreground">Total Checks</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-success">{healthData.summary.healthy}</div>
                    <div className="text-sm text-muted-foreground">Healthy</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-warning">{healthData.summary.warnings}</div>
                    <div className="text-sm text-muted-foreground">Warnings</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-destructive">{healthData.summary.critical}</div>
                    <div className="text-sm text-muted-foreground">Critical</div>
                  </CardContent>
                </Card>
              </div>

              {/* Individual Checks */}
              <div className="space-y-3">
                <h4 className="font-semibold">System Components</h4>
                {healthData.checks.map((check, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(check.status)}
                        <div>
                          <div className="font-medium">{check.component}</div>
                          <div className="text-sm text-muted-foreground">{check.message}</div>
                          {check.details && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Details: {JSON.stringify(check.details)}
                            </div>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(check.status)}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Recommendations */}
              {healthData.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {healthData.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};