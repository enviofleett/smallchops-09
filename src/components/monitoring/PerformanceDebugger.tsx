import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PerformanceMonitor } from './PerformanceMonitor';
import { FlickerDetector } from './FlickerDetector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertTriangle, Zap, Clock } from 'lucide-react';

interface PerformanceMetrics {
  navigation: number;
  largest_contentful_paint: number;
  first_input_delay: number;
  cumulative_layout_shift: number;
  memory_usage: number;
  network_requests: number;
}

export const PerformanceDebugger = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    navigation: 0,
    largest_contentful_paint: 0,
    first_input_delay: 0,
    cumulative_layout_shift: 0,
    memory_usage: 0,
    network_requests: 0
  });

  const [resourceTimings, setResourceTimings] = useState<PerformanceResourceTiming[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      // Navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        setMetrics(prev => ({
          ...prev,
          navigation: navigation.loadEventEnd - navigation.fetchStart
        }));
      }

      // Resource timings
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      setResourceTimings(resources.slice(-20)); // Keep last 20 requests

      // Memory usage (if available)
      if ((performance as any).memory) {
        setMetrics(prev => ({
          ...prev,
          memory_usage: (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
        }));
      }

      // Network requests count
      setMetrics(prev => ({
        ...prev,
        network_requests: resources.length
      }));
    };

    // LCP observer
    const lcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        setMetrics(prev => ({
          ...prev,
          largest_contentful_paint: entry.startTime
        }));
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // CLS observer
    let cls = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          cls += (entry as any).value;
          setMetrics(prev => ({
            ...prev,
            cumulative_layout_shift: cls
          }));
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);

    return () => {
      clearInterval(interval);
      lcpObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);

  const getScoreColor = (value: number, thresholds: { good: number; needs_improvement: number }) => {
    if (value <= thresholds.good) return 'bg-green-500';
    if (value <= thresholds.needs_improvement) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreProgress = (value: number, max: number) => {
    return Math.min((value / max) * 100, 100);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Performance Debugger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="metrics">Core Metrics</TabsTrigger>
              <TabsTrigger value="monitoring">System Health</TabsTrigger>
              <TabsTrigger value="flicker">Flicker Detection</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
            </TabsList>
            
            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Page Load Time</span>
                      <Badge variant="outline">{metrics.navigation.toFixed(0)}ms</Badge>
                    </div>
                    <Progress 
                      value={getScoreProgress(metrics.navigation, 3000)} 
                      className="h-2"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Largest Contentful Paint</span>
                      <Badge variant="outline">{metrics.largest_contentful_paint.toFixed(0)}ms</Badge>
                    </div>
                    <Progress 
                      value={getScoreProgress(metrics.largest_contentful_paint, 2500)} 
                      className="h-2"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Cumulative Layout Shift</span>
                      <Badge variant="outline">{metrics.cumulative_layout_shift.toFixed(3)}</Badge>
                    </div>
                    <Progress 
                      value={getScoreProgress(metrics.cumulative_layout_shift, 0.25)} 
                      className="h-2"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <Badge variant="outline">{metrics.memory_usage.toFixed(1)}MB</Badge>
                    </div>
                    <Progress 
                      value={getScoreProgress(metrics.memory_usage, 100)} 
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="monitoring">
              <PerformanceMonitor />
            </TabsContent>
            
            <TabsContent value="flicker">
              <FlickerDetector />
            </TabsContent>
            
            <TabsContent value="network" className="space-y-4">
              <div className="text-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-medium">Recent Network Requests</span>
                  <Badge variant="outline">{resourceTimings.length} total</Badge>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {resourceTimings.slice(-10).map((resource, index) => {
                    const duration = resource.responseEnd - resource.requestStart;
                    const isSlowRequest = duration > 1000;
                    
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded text-xs">
                        <div className="flex items-center gap-2">
                          {isSlowRequest && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                          <span className="truncate max-w-xs">{resource.name.split('/').pop()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isSlowRequest ? "destructive" : "secondary"}>
                            {duration.toFixed(0)}ms
                          </Badge>
                          <span className="text-muted-foreground">
                            {Math.round(resource.transferSize / 1024)}KB
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};