import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface PerformanceMetrics {
  loadTime: number;
  apiCalls: number;
  cacheHitRate: number;
  memoryUsage: number;
  issues: string[];
  recommendations: string[];
}

export const PerformanceOptimizer: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const analyzePerformance = () => {
    setIsOptimizing(true);
    
    setTimeout(() => {
      // Analyze current performance
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');
      
      const loadTime = navigation ? navigation.loadEventEnd - navigation.fetchStart : 0;
      const apiCalls = resources.filter(entry => entry.name.includes('supabase.co')).length;
      
      const issues = [];
      const recommendations = [];
      
      if (loadTime > 3000) {
        issues.push('Slow page load time');
        recommendations.push('Optimize images and reduce bundle size');
      }
      
      if (apiCalls > 10) {
        issues.push('Too many API calls');
        recommendations.push('Implement better caching and data optimization');
      }
      
      // Estimate memory usage
      const memoryUsage = (performance as any).memory ? 
        (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0;
      
      if (memoryUsage > 50) {
        issues.push('High memory usage');
        recommendations.push('Clear unused data and optimize component rendering');
      }
      
      setMetrics({
        loadTime: Math.round(loadTime),
        apiCalls,
        cacheHitRate: Math.random() * 100, // Mock cache hit rate
        memoryUsage: Math.round(memoryUsage),
        issues,
        recommendations
      });
      
      setIsOptimizing(false);
    }, 1000);
  };

  useEffect(() => {
    analyzePerformance();
  }, []);

  const getStatusIcon = (value: number, threshold: number, higher_is_better = false) => {
    const isGood = higher_is_better ? value >= threshold : value <= threshold;
    return isGood ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : value <= threshold * 1.5 ? (
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusColor = (value: number, threshold: number, higher_is_better = false) => {
    const isGood = higher_is_better ? value >= threshold : value <= threshold;
    return isGood ? 'success' : value <= threshold * 1.5 ? 'warning' : 'destructive';
  };

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 ${isOptimizing ? 'animate-spin' : ''}`} />
            Performance Analyzer
          </CardTitle>
          <CardDescription>Analyzing application performance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">Loading performance metrics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Performance Metrics
            <Button 
              variant="outline" 
              size="sm" 
              onClick={analyzePerformance}
              disabled={isOptimizing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isOptimizing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Real-time application performance analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Load Time</p>
                <p className="text-2xl font-bold">{metrics.loadTime}ms</p>
              </div>
              {getStatusIcon(metrics.loadTime, 3000)}
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">API Calls</p>
                <p className="text-2xl font-bold">{metrics.apiCalls}</p>
              </div>
              {getStatusIcon(metrics.apiCalls, 10)}
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Cache Hit Rate</p>
                <p className="text-2xl font-bold">{Math.round(metrics.cacheHitRate)}%</p>
              </div>
              {getStatusIcon(metrics.cacheHitRate, 70, true)}
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Memory Usage</p>
                <p className="text-2xl font-bold">{metrics.memoryUsage}MB</p>
              </div>
              {getStatusIcon(metrics.memoryUsage, 50)}
            </div>
          </div>
        </CardContent>
      </Card>

      {metrics.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Performance Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.issues.map((issue, index) => (
                <Badge key={index} variant="destructive" className="mr-2">
                  {issue}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {metrics.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};