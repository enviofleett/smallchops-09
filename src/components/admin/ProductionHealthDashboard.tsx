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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Overall Health Score */}
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center justify-between">
            System Health
            <div className="flex md:hidden">
              {isHealthy ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="hidden md:flex">
                {isHealthy ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
              </div>
              <span className="text-xl md:text-2xl font-bold">
                {healthScore ? `${Math.round(healthScore)}%` : 'N/A'}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isHealthy ? 'All systems operational' : 'Issues detected'}
          </p>
        </CardContent>
      </Card>

      {/* Event Volume */}
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center justify-between">
            Event Volume
            <TrendingUp className="w-4 h-4 md:hidden text-blue-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="hidden md:flex w-5 h-5 text-blue-500" />
              <span className="text-xl md:text-2xl font-bold">
                {latestMetrics?.total_events || 0}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Events in last hour
          </p>
        </CardContent>
      </Card>

      {/* Collision Rate */}
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center justify-between">
            Collision Rate
            <AlertTriangle className="w-4 h-4 md:hidden text-orange-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="hidden md:flex w-5 h-5 text-orange-500" />
              <span className="text-xl md:text-2xl font-bold">
                {latestMetrics ? 
                  `${((latestMetrics.collision_events / Math.max(latestMetrics.total_events, 1)) * 100).toFixed(1)}%` 
                  : '0%'
                }
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {latestMetrics?.collision_events || 0} collisions detected
          </p>
        </CardContent>
      </Card>

      {/* Average Retries */}
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center justify-between">
            Avg Retries
            <Clock className="w-4 h-4 md:hidden text-purple-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="hidden md:flex w-5 h-5 text-purple-500" />
              <span className="text-xl md:text-2xl font-bold">
                {latestMetrics?.avg_retry_count ? 
                  Number(latestMetrics.avg_retry_count).toFixed(2) 
                  : '0.00'
                }
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Retry attempts per event
          </p>
        </CardContent>
      </Card>

      {/* Recent Collisions - Mobile Optimized */}
      {collisionLogs && collisionLogs.length > 0 && (
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm md:text-base">Recent Collisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {collisionLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-muted rounded-lg gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Order {log.order_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.event_type} • {log.collision_count} collisions
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {log.resolution_strategy}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
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