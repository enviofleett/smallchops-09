import React from 'react';
import { useHealthMonitor } from '@/hooks/useHealthMonitor';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Activity } from 'lucide-react';

export const PerformanceMonitor = () => {
  const { healthMetrics, isHealthy } = useHealthMonitor();

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isHealthy ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          )}
          <span className="font-medium">System Performance</span>
        </div>
        <Badge variant={isHealthy ? "default" : "secondary"}>
          {isHealthy ? "Healthy" : "Monitoring"}
        </Badge>
      </div>
      
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          <span>Cart API Calls: {healthMetrics.cart_tracking_calls}</span>
        </div>
        <div>
          <span>Error Rate: {(healthMetrics.performance.error_rate * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span>Last Check: {new Date(healthMetrics.last_check).toLocaleTimeString()}</span>
        </div>
      </div>
      
      {healthMetrics.issues.length > 0 && (
        <div className="mt-3 p-2 bg-yellow-50 rounded text-xs">
          <strong>Issues Detected:</strong>
          <ul className="mt-1">
            {healthMetrics.issues.map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};