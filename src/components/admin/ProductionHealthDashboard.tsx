import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProductionMonitoring } from '@/hooks/useProductionMonitoring';
import { AlertTriangle, CheckCircle, TrendingUp, Clock } from 'lucide-react';

export const ProductionHealthDashboard = () => {
  const { healthMetrics, collisionLogs, healthScore, isHealthy, errors } = useProductionMonitoring();

  if (errors.health || errors.collision) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Monitoring Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Unable to load production health metrics. Check system status.</p>
        </CardContent>
      </Card>
    );
  }

  const latestMetrics = healthMetrics?.[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Overall Health Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            {isHealthy ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-2xl font-bold">
              {healthScore ? `${Math.round(healthScore)}%` : 'N/A'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isHealthy ? 'All systems operational' : 'Issues detected'}
          </p>
        </CardContent>
      </Card>

      {/* Event Volume */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Event Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold">
              {latestMetrics?.total_events || 0}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Events in last hour
          </p>
        </CardContent>
      </Card>

      {/* Collision Rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Collision Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-bold">
              {latestMetrics ? 
                `${((latestMetrics.collision_events / Math.max(latestMetrics.total_events, 1)) * 100).toFixed(1)}%` 
                : '0%'
              }
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {latestMetrics?.collision_events || 0} collisions detected
          </p>
        </CardContent>
      </Card>

      {/* Average Retries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Avg Retries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-purple-500" />
            <span className="text-2xl font-bold">
              {latestMetrics?.avg_retry_count ? 
                Number(latestMetrics.avg_retry_count).toFixed(2) 
                : '0.00'
              }
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Retry attempts per event
          </p>
        </CardContent>
      </Card>

      {/* Recent Collisions */}
      {collisionLogs && collisionLogs.length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Collisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {collisionLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-sm font-medium">Order {log.order_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.event_type} • {log.collision_count} collisions
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {log.resolution_strategy}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.last_collision_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};