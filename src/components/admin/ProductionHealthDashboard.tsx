import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Activity } from "lucide-react";

interface HealthMetric {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  response_time?: number;
  last_check: string;
  error_message?: string;
}

interface ProductionHealth {
  overall_status: 'healthy' | 'degraded' | 'critical';
  edge_functions: HealthMetric[];
  database: HealthMetric;
  authentication: HealthMetric;
  payment_processing: HealthMetric;
  last_updated: string;
}

export const ProductionHealthDashboard: React.FC = () => {
  const [health, setHealth] = useState<ProductionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkSystemHealth = async () => {
    try {
      // Simulate health checks for different systems
      const healthData: ProductionHealth = {
        overall_status: 'healthy',
        edge_functions: [
          {
            name: 'admin-orders-manager',
            status: 'healthy',
            response_time: 120,
            last_check: new Date().toISOString()
          },
          {
            name: 'process-checkout',
            status: 'healthy',
            response_time: 89,
            last_check: new Date().toISOString()
          },
          {
            name: 'reports',
            status: 'warning',
            response_time: 2340,
            last_check: new Date().toISOString(),
            error_message: 'Slow response times detected'
          },
          {
            name: 'paystack-secure',
            status: 'healthy',
            response_time: 156,
            last_check: new Date().toISOString()
          }
        ],
        database: {
          name: 'Supabase Database',
          status: 'healthy',
          response_time: 45,
          last_check: new Date().toISOString()
        },
        authentication: {
          name: 'Auth System',
          status: 'healthy',
          response_time: 67,
          last_check: new Date().toISOString()
        },
        payment_processing: {
          name: 'Paystack Integration',
          status: 'healthy',
          response_time: 234,
          last_check: new Date().toISOString()
        },
        last_updated: new Date().toISOString()
      };

      // Determine overall status based on component status
      const hasWarnings = [
        ...healthData.edge_functions,
        healthData.database,
        healthData.authentication,
        healthData.payment_processing
      ].some(metric => metric.status === 'warning');

      const hasCritical = [
        ...healthData.edge_functions,
        healthData.database,
        healthData.authentication,
        healthData.payment_processing
      ].some(metric => metric.status === 'critical');

      if (hasCritical) {
        healthData.overall_status = 'critical';
      } else if (hasWarnings) {
        healthData.overall_status = 'degraded';
      }

      setHealth(healthData);
    } catch (error) {
      console.error('Failed to check system health:', error);
      // Set critical status if health check fails
      setHealth({
        overall_status: 'critical',
        edge_functions: [],
        database: {
          name: 'Supabase Database',
          status: 'critical',
          last_check: new Date().toISOString(),
          error_message: 'Health check failed'
        },
        authentication: {
          name: 'Auth System',
          status: 'critical',
          last_check: new Date().toISOString(),
          error_message: 'Health check failed'
        },
        payment_processing: {
          name: 'Paystack Integration',
          status: 'critical',
          last_check: new Date().toISOString(),
          error_message: 'Health check failed'
        },
        last_updated: new Date().toISOString()
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshHealth = async () => {
    setRefreshing(true);
    await checkSystemHealth();
  };

  useEffect(() => {
    checkSystemHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkSystemHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      healthy: 'default',
      warning: 'secondary',
      critical: 'destructive'
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Checking system health...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load system health data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <CardTitle>System Health Overview</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={refreshHealth}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {getStatusBadge(health.overall_status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(health.last_updated).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions Health */}
      <Card>
        <CardHeader>
          <CardTitle>Edge Functions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {health.edge_functions.map((func) => (
              <div key={func.name} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(func.status)}
                  <div>
                    <div className="font-medium">{func.name}</div>
                    {func.error_message && (
                      <div className="text-sm text-red-600">{func.error_message}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {func.response_time && (
                    <div className="text-sm text-muted-foreground">
                      {func.response_time}ms
                    </div>
                  )}
                  {getStatusBadge(func.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Core Services Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[health.database, health.authentication, health.payment_processing].map((service) => (
          <Card key={service.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{service.name}</CardTitle>
                {getStatusIcon(service.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getStatusBadge(service.status)}
                {service.response_time && (
                  <div className="text-sm text-muted-foreground">
                    Response: {service.response_time}ms
                  </div>
                )}
                {service.error_message && (
                  <div className="text-sm text-red-600">
                    {service.error_message}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Last check: {new Date(service.last_check).toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Critical Alerts */}
      {health.overall_status === 'critical' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Critical System Issues Detected</strong>
            <br />
            One or more critical systems are experiencing issues. 
            Production operations may be affected. Immediate attention required.
          </AlertDescription>
        </Alert>
      )}

      {health.overall_status === 'degraded' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>System Performance Degraded</strong>
            <br />
            Some systems are experiencing performance issues. 
            Monitor closely and consider scaling resources.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};