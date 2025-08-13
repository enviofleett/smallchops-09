import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface EnvironmentHealth {
  paystack_configured: boolean;
  secret_key_format: 'test' | 'live' | 'invalid' | 'missing';
  database_connectivity: boolean;
  edge_functions_accessible: boolean;
  recommended_actions: string[];
  critical_issues: string[];
  warnings: string[];
}

interface HealthCheckResult {
  success: boolean;
  timestamp: string;
  environment_status: EnvironmentHealth;
  overall_health: 'healthy' | 'critical';
  ready_for_payments: boolean;
}

export const PaymentHealthMonitor: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[HEALTH-CHECK] Starting payment environment audit');
      
      const { data, error } = await supabase.functions.invoke('payment-environment-manager');

      if (error) {
        throw new Error(error.message || 'Health check failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Health check returned unsuccessful result');
      }

      setHealthData(data);
      console.log('[HEALTH-CHECK] Health check completed:', data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      setError(errorMessage);
      console.error('[HEALTH-CHECK] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const getHealthIcon = (status: 'healthy' | 'critical' | 'warning') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'critical' | 'warning') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Running Payment Health Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Checking payment environment configuration...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>Health check failed: {error}</span>
            <Button onClick={runHealthCheck} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!healthData) {
    return null;
  }

  const { environment_status, overall_health, ready_for_payments } = healthData;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {getHealthIcon(overall_health)}
              Payment System Health
            </span>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(overall_health)}>
                {overall_health.toUpperCase()}
              </Badge>
              <Button onClick={runHealthCheck} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Ready for Payments:</span>
            {ready_for_payments ? (
              <Badge className="bg-green-100 text-green-800">Yes</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800">No</Badge>
            )}
          </div>

          {/* Component Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              {environment_status.paystack_configured ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Paystack Configuration</span>
            </div>
            
            <div className="flex items-center gap-2">
              {environment_status.database_connectivity ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Database Connection</span>
            </div>
            
            <div className="flex items-center gap-2">
              {environment_status.secret_key_format === 'test' || environment_status.secret_key_format === 'live' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Secret Key Format</span>
              <Badge variant="outline" className="text-xs">
                {environment_status.secret_key_format}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {environment_status.edge_functions_accessible ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Edge Functions</span>
            </div>
          </div>

          {/* Critical Issues */}
          {environment_status.critical_issues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <strong>Critical Issues:</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {environment_status.critical_issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {environment_status.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <strong>Warnings:</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {environment_status.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Recommendations */}
          {environment_status.recommended_actions.length > 0 && (
            <div className="space-y-2">
              <strong className="text-sm">Recommended Actions:</strong>
              <ul className="list-disc pl-4 space-y-1">
                {environment_status.recommended_actions.map((action, index) => (
                  <li key={index} className="text-sm text-muted-foreground">{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Last checked: {new Date(healthData.timestamp).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};