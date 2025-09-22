import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminErrorStore } from '@/stores/adminErrorStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Database,
  Network,
  AlertCircle
} from 'lucide-react';

interface PerformanceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  lockContentionRate: number;
  errorRate: number;
  uptime: number;
}

interface RealtimeMetric {
  timestamp: number;
  operation: string;
  success: boolean;
  responseTime: number;
  cacheHit: boolean;
  errorType?: string;
}

export const PerformanceMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [realtimeData, setRealtimeData] = useState<RealtimeMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const { errors, detectPatterns, getUnresolvedErrors } = useAdminErrorStore();

  // Fetch performance metrics
  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: { action: 'get_performance_metrics' }
      });

      if (error) throw error;
      setMetrics(data?.metrics || null);
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      toast.error('Failed to load performance data');
    }
  };

  // Fetch realtime data
  const fetchRealtimeData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
        body: { 
          action: 'get_realtime_metrics',
          limit: 50
        }
      });

      if (error) throw error;
      setRealtimeData(data?.realtime || []);
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMetrics(), fetchRealtimeData()]);
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
      fetchRealtimeData();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Calculate derived metrics
  const getHealthScore = (): number => {
    if (!metrics) return 0;
    
    const successRate = (metrics.successfulOperations / metrics.totalOperations) * 100;
    const cacheScore = metrics.cacheHitRate;
    const performanceScore = Math.max(0, 100 - (metrics.averageResponseTime / 10));
    const contentionScore = Math.max(0, 100 - metrics.lockContentionRate);
    
    return Math.round((successRate + cacheScore + performanceScore + contentionScore) / 4);
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }): string => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading performance metrics...
        </CardContent>
      </Card>
    );
  }

  const healthScore = getHealthScore();
  const unresolvedErrors = getUnresolvedErrors();
  const errorPatterns = detectPatterns();

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitoring</h2>
          <p className="text-muted-foreground">Real-time system health and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchMetrics();
              fetchRealtimeData();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={healthScore} className="mb-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Poor</span>
                <span>Good</span>
                <span>Excellent</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${getStatusColor(healthScore, { good: 80, warning: 60 })}`}>
                {healthScore}%
              </div>
              <p className="text-sm text-muted-foreground">Overall Health</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className={`text-2xl font-bold ${getStatusColor(
                    (metrics.successfulOperations / metrics.totalOperations) * 100,
                    { good: 95, warning: 90 }
                  )}`}>
                    {((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                  <p className={`text-2xl font-bold ${getStatusColor(
                    1000 - metrics.averageResponseTime,
                    { good: 800, warning: 500 }
                  )}`}>
                    {formatDuration(metrics.averageResponseTime)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                  <p className={`text-2xl font-bold ${getStatusColor(
                    metrics.cacheHitRate,
                    { good: 80, warning: 60 }
                  )}`}>
                    {metrics.cacheHitRate.toFixed(1)}%
                  </p>
                </div>
                <Database className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                  <p className={`text-2xl font-bold ${getStatusColor(
                    100 - metrics.errorRate,
                    { good: 95, warning: 90 }
                  )}`}>
                    {metrics.errorRate.toFixed(2)}%
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="realtime" className="space-y-4">
        <TabsList>
          <TabsTrigger value="realtime">Real-time Activity</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime">
          <Card>
            <CardHeader>
              <CardTitle>Recent Operations</CardTitle>
              <CardDescription>Last 50 operations with response times and success status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {realtimeData.map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      {metric.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">{metric.operation}</span>
                      {metric.cacheHit && (
                        <Badge variant="secondary" className="text-xs">Cache Hit</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDuration(metric.responseTime)}</span>
                      <span>{new Date(metric.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
              <CardDescription>Current error patterns and unresolved issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Patterns */}
              {errorPatterns.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-2">Detected Patterns</h4>
                  <div className="space-y-2">
                    {errorPatterns.map((pattern, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded border-l-4 border-red-500">
                        <div>
                          <span className="font-medium capitalize">{pattern.type} Errors</span>
                          <p className="text-sm text-muted-foreground">
                            {pattern.count} occurrences affecting {pattern.affectedOrders.length} orders
                          </p>
                        </div>
                        <Badge variant="destructive">{pattern.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unresolved Errors */}
              {unresolvedErrors.length > 0 && (
                <div>
                  <h4 className="font-medium text-orange-700 mb-2">Unresolved Errors</h4>
                  <div className="space-y-2">
                    {unresolvedErrors.slice(0, 10).map((error) => (
                      <div key={error.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <div>
                          <span className="font-medium">Order {error.orderId}</span>
                          <p className="text-sm text-muted-foreground">{error.error}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{error.retryCount} retries</Badge>
                          <Badge variant="secondary">{error.errorType}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errorPatterns.length === 0 && unresolvedErrors.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-sm font-semibold text-green-700">No Error Patterns Detected</h3>
                  <p className="mt-1 text-sm text-muted-foreground">System is operating normally</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Historical performance data and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">Performance Trends</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Historical trend analysis coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};