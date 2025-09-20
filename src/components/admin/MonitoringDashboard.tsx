// Phase 5.2: Real-time Monitoring Dashboard
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Lock,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
  XCircle
} from 'lucide-react';
import useRealTimeMonitoring, { AlertRule } from '@/hooks/useRealTimeMonitoring';

export const MonitoringDashboard: React.FC = () => {
  const {
    cacheHealth,
    lockMetrics,
    performance,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    refreshMetrics,
    alertRules,
    updateAlertRules
  } = useRealTimeMonitoring();

  const [localAlertRules, setLocalAlertRules] = useState<AlertRule[]>(alertRules);

  useEffect(() => {
    // Auto-start monitoring when component mounts
    startMonitoring(10000); // Update every 10 seconds

    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  const getHealthStatus = () => {
    if (!performance) return 'unknown';
    return performance.systemHealth;
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const updateAlertRule = (id: string, updates: Partial<AlertRule>) => {
    const updated = localAlertRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    );
    setLocalAlertRules(updated);
    updateAlertRules(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time performance and health monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm text-muted-foreground">
              {isMonitoring ? 'Live' : 'Stopped'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${getHealthColor(getHealthStatus())}`}>
                {getHealthStatus() === 'healthy' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : getHealthStatus() === 'degraded' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold capitalize">{getHealthStatus()}</p>
                <p className="text-sm text-muted-foreground">System Health</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-50 text-blue-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {performance ? formatPercentage(performance.successRate) : '0%'}
                </p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-50 text-purple-600">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {cacheHealth ? formatPercentage(cacheHealth.hitRate) : '0%'}
                </p>
                <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-50 text-orange-600">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {lockMetrics?.activeLocks || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active Locks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <div className="font-medium text-red-800 mb-2">Active Alerts ({alerts.length})</div>
            <ul className="list-disc list-inside text-sm text-red-700">
              {alerts.map((alert, index) => (
                <li key={index}>{alert}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cache">Cache Health</TabsTrigger>
          <TabsTrigger value="locks">Lock Contention</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Cache Health Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cacheHealth ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Hit Rate</span>
                        <span className="font-mono">{formatPercentage(cacheHealth.hitRate)}</span>
                      </div>
                      <Progress value={cacheHealth.hitRate * 100} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Error Rate</span>
                        <span className="font-mono">{formatPercentage(cacheHealth.errorRate)}</span>
                      </div>
                      <Progress 
                        value={cacheHealth.errorRate * 100} 
                        className="[&>div]:bg-red-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Active Entries</span>
                        <p className="font-mono">{cacheHealth.activeEntries}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Response</span>
                        <p className="font-mono">{formatDuration(cacheHealth.avgResponseTime)}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Loading cache metrics...</p>
                )}
              </CardContent>
            </Card>

            {/* Lock Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Lock Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lockMetrics ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Active Locks</span>
                        <p className="text-2xl font-bold">{lockMetrics.activeLocks}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expired Locks</span>
                        <p className="text-2xl font-bold text-red-600">{lockMetrics.expiredLocks}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Average Lock Duration</span>
                      <p className="font-mono">{formatDuration(lockMetrics.averageLockDuration)}</p>
                    </div>

                    {lockMetrics.lockHolders.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Current Lock Holders</span>
                        <div className="mt-2 space-y-1">
                          {lockMetrics.lockHolders.slice(0, 3).map((holder, index) => (
                            <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                              Order: {holder.orderId.slice(0, 8)}... 
                              <span className="text-muted-foreground ml-2">
                                ({formatDuration(holder.duration)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Loading lock metrics...</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Health Metrics</CardTitle>
              <CardDescription>
                Detailed cache performance and health statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cacheHealth ? (
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Performance Metrics</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Cache Hit Rate</span>
                          <span className="font-mono">{formatPercentage(cacheHealth.hitRate)}</span>
                        </div>
                        <Progress value={cacheHealth.hitRate * 100} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Miss Rate</span>
                          <span className="font-mono">{formatPercentage(cacheHealth.missRate)}</span>
                        </div>
                        <Progress value={cacheHealth.missRate * 100} className="[&>div]:bg-yellow-500" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Error Rate</span>
                          <span className="font-mono">{formatPercentage(cacheHealth.errorRate)}</span>
                        </div>
                        <Progress value={cacheHealth.errorRate * 100} className="[&>div]:bg-red-500" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Cache Statistics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Active Entries</span>
                        <span className="font-mono">{cacheHealth.activeEntries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Expired Entries</span>
                        <span className="font-mono">{cacheHealth.expiredEntries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Average Response Time</span>
                        <span className="font-mono">{formatDuration(cacheHealth.avgResponseTime)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Health Status</h3>
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        Last Updated: {new Date(cacheHealth.lastUpdated).toLocaleTimeString()}
                      </div>
                      
                      {cacheHealth.hitRate < 0.8 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            Low cache hit rate detected. Consider reviewing cache configuration.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {cacheHealth.errorRate > 0.05 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            High error rate detected. Check cache system health.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Loading cache health metrics...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lock Contention Analysis</CardTitle>
              <CardDescription>
                Monitor database locks and contention patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lockMetrics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{lockMetrics.activeLocks}</p>
                      <p className="text-sm text-muted-foreground">Active Locks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{lockMetrics.expiredLocks}</p>
                      <p className="text-sm text-muted-foreground">Expired Locks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{lockMetrics.lockConflicts}</p>
                      <p className="text-sm text-muted-foreground">Conflicts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{lockMetrics.maxConcurrentLocks}</p>
                      <p className="text-sm text-muted-foreground">Peak Concurrent</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Average Lock Duration</h3>
                    <p className="text-lg font-mono">{formatDuration(lockMetrics.averageLockDuration)}</p>
                  </div>

                  {lockMetrics.lockHolders.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-3">Current Lock Holders</h3>
                      <div className="space-y-2">
                        {lockMetrics.lockHolders.map((holder, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <p className="font-mono text-sm">Order: {holder.orderId}</p>
                              <p className="text-xs text-muted-foreground">Admin: {holder.adminId}</p>
                            </div>
                            <div className="text-right text-sm">
                              <p>Duration: {formatDuration(holder.duration)}</p>
                              <p className="text-xs text-muted-foreground">
                                Expires in: {formatDuration(holder.expiresIn)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Loading lock metrics...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                System performance and throughput analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performance ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatPercentage(performance.successRate)}</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{performance.throughput.toFixed(1)}</p>
                      <p className="text-sm text-muted-foreground">Ops/Min</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatDuration(performance.orderUpdateLatency)}</p>
                      <p className="text-sm text-muted-foreground">Avg Latency</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">System Health Status</h3>
                    <Badge className={`text-sm px-3 py-1 ${getHealthColor(performance.systemHealth)}`}>
                      {performance.systemHealth.toUpperCase()}
                    </Badge>
                  </div>

                  {Object.keys(performance.errorsByType).length > 0 && (
                    <div>
                      <h3 className="font-medium mb-3">Error Breakdown</h3>
                      <div className="space-y-2">
                        {Object.entries(performance.errorsByType).map(([errorType, count]) => (
                          <div key={errorType} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm">{errorType}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Loading performance metrics...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>
                Configure automated alerts for system monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {localAlertRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="space-y-1">
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-sm text-muted-foreground">{rule.condition}</p>
                      <Badge className={
                        rule.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        rule.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        rule.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {rule.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-mono">Threshold: {rule.threshold}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => updateAlertRule(rule.id, { enabled: checked })}
                        />
                        <Label htmlFor={`alert-${rule.id}`} className="text-sm">
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;