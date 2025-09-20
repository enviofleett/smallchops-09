import React from 'react';
import { useRealTimeMonitoring } from '@/hooks/useRealTimeMonitoring';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Clock, Shield, RefreshCcw } from 'lucide-react';

export const ConflictResolutionDashboard = () => {
  const { conflictMetrics, performance, alerts, isMonitoring, startMonitoring, stopMonitoring } = useRealTimeMonitoring();

  React.useEffect(() => {
    if (!isMonitoring) {
      startMonitoring(15000); // Update every 15 seconds
    }
    return () => stopMonitoring();
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  if (!conflictMetrics || !performance) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          <span>Loading conflict resolution metrics...</span>
        </div>
      </Card>
    );
  }

  const getHealthStatus = (rate: number, threshold: number): { status: string; color: 'destructive' | 'secondary' | 'default' | 'outline' } => {
    if (rate > threshold * 2) return { status: 'critical', color: 'destructive' };
    if (rate > threshold) return { status: 'warning', color: 'secondary' };
    return { status: 'healthy', color: 'default' };
  };

  const conflictStatus = getHealthStatus(conflictMetrics.conflictRate, 0.1);
  const resolutionStatus = getHealthStatus(conflictMetrics.avgConflictResolutionTime, 3000);

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">409 Conflict Resolution Monitor</h2>
          <p className="text-muted-foreground">Real-time monitoring of order update conflicts</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={performance.systemHealth === 'healthy' ? 'default' : 'destructive'}>
            {performance.systemHealth === 'healthy' ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : (
              <AlertTriangle className="w-3 h-3 mr-1" />
            )}
            {performance.systemHealth}
          </Badge>
          <Badge variant={isMonitoring ? 'default' : 'secondary'}>
            {isMonitoring ? 'Live' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-destructive rounded-full" />
                  {alert}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Conflict Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conflict Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {(conflictMetrics.conflictRate * 100).toFixed(1)}%
              </div>
              <Badge variant={conflictStatus.color}>
                {conflictStatus.status}
              </Badge>
            </div>
            <Progress 
              value={conflictMetrics.conflictRate * 100} 
              max={20}
              className="mt-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Target: &lt;10%
            </p>
          </CardContent>
        </Card>

        {/* Resolution Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {conflictMetrics.avgConflictResolutionTime.toFixed(0)}ms
              </div>
              <Badge variant={resolutionStatus.color}>
                {resolutionStatus.status}
              </Badge>
            </div>
            <Progress 
              value={Math.min(conflictMetrics.avgConflictResolutionTime / 50, 100)} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Target: &lt;3s
            </p>
          </CardContent>
        </Card>

        {/* Retry Success Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCcw className="w-4 h-4" />
              Retry Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(conflictMetrics.retrySuccessRate * 100).toFixed(1)}%
            </div>
            <Progress 
              value={conflictMetrics.retrySuccessRate * 100} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Retries that succeed
            </p>
          </CardContent>
        </Card>

        {/* Cache Bypass Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Cache Bypass Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(conflictMetrics.cacheBypassRate * 100).toFixed(1)}%
            </div>
            <Progress 
              value={conflictMetrics.cacheBypassRate * 100} 
              max={50}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Emergency bypasses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Lock Wait Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Lock Wait Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conflictMetrics.lockWaitTimes.length > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm">Min:</span>
                    <span className="font-mono">{Math.min(...conflictMetrics.lockWaitTimes)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg:</span>
                    <span className="font-mono">
                      {(conflictMetrics.lockWaitTimes.reduce((a, b) => a + b, 0) / conflictMetrics.lockWaitTimes.length).toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Max:</span>
                    <span className="font-mono">{Math.max(...conflictMetrics.lockWaitTimes)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Samples:</span>
                    <span className="font-mono">{conflictMetrics.lockWaitTimes.length}</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No lock wait time data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Concurrent Session Conflicts */}
        <Card>
          <CardHeader>
            <CardTitle>Concurrent Session Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Multi-admin Conflicts:</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{conflictMetrics.concurrentSessionConflicts}</span>
                  <Badge variant={conflictMetrics.concurrentSessionConflicts > 5 ? 'destructive' : 'secondary'}>
                    {conflictMetrics.concurrentSessionConflicts > 5 ? 'High' : 'Normal'}
                  </Badge>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Conflicts involving multiple admin sessions simultaneously updating the same order.
              </div>
              
              <Progress 
                value={Math.min(conflictMetrics.concurrentSessionConflicts * 10, 100)} 
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConflictResolutionDashboard;