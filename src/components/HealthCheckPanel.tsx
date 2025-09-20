import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Shield } from 'lucide-react';
import { healthChecker } from '@/utils/healthChecker';
import type { WebsiteHealth } from '@/utils/healthChecker';

export const HealthCheckPanel = () => {
  const [health, setHealth] = useState<WebsiteHealth | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');

  const runHealthCheck = async () => {
    setIsRunning(true);
    try {
      const result = await healthChecker.runFullHealthCheck();
      setHealth(result);
      setLastCheck(new Date().toLocaleString());
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const autoFixIssues = async () => {
    const fixes = await healthChecker.autoFixIssues();
    if (fixes.length > 0) {
      // Re-run health check after fixes
      await runHealthCheck();
    }
  };

  useEffect(() => {
    // Run initial health check
    runHealthCheck();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Website Health Check
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={runHealthCheck}
              disabled={isRunning}
              size="sm"
              variant="outline"
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Check
            </Button>
            {health && (
              <Button
                onClick={autoFixIssues}
                size="sm"
                variant="outline"
              >
                Auto Fix
              </Button>
            )}
          </div>
        </div>
        {lastCheck && (
          <p className="text-sm text-muted-foreground">
            Last check: {lastCheck}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!health ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Click "Check" to run health diagnostics</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">Overall Status</span>
              <Badge variant={getStatusColor(health.overall)} className="flex items-center gap-1">
                {getStatusIcon(health.overall)}
                {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
              </Badge>
            </div>

            {/* Individual Checks */}
            <div className="space-y-2">
              {Object.entries(health.checks).map(([key, check]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <span className="capitalize">{key}</span>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusColor(check.status)}>
                      {check.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {check.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Flickering Check */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Flickering Detection
              </p>
              <p className="text-sm text-blue-700">
                {healthChecker.checkForFlickering() 
                  ? '⚠️ Flickering detected - excessive loading animations found'
                  : '✅ No flickering issues detected'
                }
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};