import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ShoppingCart, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { formatCurrency } from '@/lib/discountCalculations';
import { MOQValidationService } from '@/services/MOQValidationService';
import { supabase } from '@/integrations/supabase/client';

interface MOQAnalyticsData {
  totalViolations: number;
  recentViolations: number;
  topViolatedProducts: Array<{
    productId: string;
    productName: string;
    violationCount: number;
    revenueImpact: number;
  }>;
  actionBreakdown: {
    blocked: number;
    adjusted: number;
    override: number;
  };
  trendsData: Array<{
    date: string;
    violations: number;
    adjustments: number;
  }>;
}

export const MOQAnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState<MOQAnalyticsData | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7days');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // Load MOQ audit logs
      const { data: logs, error } = await (supabase as any)
        .from('moq_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load MOQ logs:', error);
        return;
      }

      setRecentLogs(logs || []);

      // Process analytics data
      const now = new Date();
      const rangeStart = new Date();
      
      switch (timeRange) {
        case '24h':
          rangeStart.setHours(now.getHours() - 24);
          break;
        case '7days':
          rangeStart.setDate(now.getDate() - 7);
          break;
        case '30days':
          rangeStart.setDate(now.getDate() - 30);
          break;
      }

      const filteredLogs = logs.filter(log => 
        new Date(log.created_at) >= rangeStart
      );

      // Calculate analytics
      const actionBreakdown = filteredLogs.reduce((acc, log) => {
        acc[log.action_taken as keyof typeof acc] = (acc[log.action_taken as keyof typeof acc] || 0) + 1;
        return acc;
      }, { blocked: 0, adjusted: 0, override: 0 });

      // Get product violation counts
      const productViolations: { [key: string]: { name: string; count: number } } = {};
      
      filteredLogs.forEach(log => {
        const violationDetails = log.violation_details as any;
        if (violationDetails?.violations) {
          violationDetails.violations.forEach((violation: any) => {
            const productId = violation.product_id;
            if (!productViolations[productId]) {
              productViolations[productId] = {
                name: violation.product_name || 'Unknown Product',
                count: 0
              };
            }
            productViolations[productId].count++;
          });
        }
      });

      const topViolatedProducts = Object.entries(productViolations)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          violationCount: data.count,
          revenueImpact: 0 // Would need additional calculation
        }))
        .sort((a, b) => b.violationCount - a.violationCount)
        .slice(0, 5);

      setAnalytics({
        totalViolations: logs.length,
        recentViolations: filteredLogs.length,
        topViolatedProducts,
        actionBreakdown,
        trendsData: [] // Would need additional processing for trends
      });

    } catch (error) {
      console.error('Failed to load MOQ analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const csvContent = [
        ['Date', 'Order ID', 'Customer ID', 'Action Taken', 'Violations', 'Notes'].join(','),
        ...recentLogs.map(log => [
          new Date(log.created_at).toLocaleDateString(),
          log.order_id || 'N/A',
          log.customer_id || 'N/A',
          log.action_taken,
          JSON.stringify(log.violation_details).replace(/,/g, ';'),
          (log.notes || '').replace(/,/g, ';')
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moq-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading MOQ analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MOQ Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor minimum order quantity compliance and violations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Violations</p>
                <p className="text-2xl font-bold">{analytics?.totalViolations || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recent Period</p>
                <p className="text-2xl font-bold">{analytics?.recentViolations || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Auto-Adjusted</p>
                <p className="text-2xl font-bold">{analytics?.actionBreakdown.adjusted || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Blocked Orders</p>
                <p className="text-2xl font-bold">{analytics?.actionBreakdown.blocked || 0}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Violated Products */}
      <Card>
        <CardHeader>
          <CardTitle>Most Violated Products</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.topViolatedProducts.length ? (
            <div className="space-y-3">
              {analytics.topViolatedProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{product.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.violationCount} violations
                      </p>
                    </div>
                  </div>
                  {product.revenueImpact > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-medium">Revenue Impact</p>
                      <p className="text-sm text-red-600">
                        {formatCurrency(product.revenueImpact)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No MOQ violations in the selected period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent MOQ Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length ? (
            <div className="space-y-3">
              {recentLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={
                        log.action_taken === 'blocked' ? 'destructive' :
                        log.action_taken === 'adjusted' ? 'default' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {log.action_taken}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        Order: {log.order_id?.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {log.violation_details?.violations?.length || 0} violations
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recent MOQ activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Action Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded">
              <p className="text-2xl font-bold text-red-600">
                {analytics?.actionBreakdown.blocked || 0}
              </p>
              <p className="text-sm text-muted-foreground">Blocked Orders</p>
            </div>
            <div className="text-center p-4 border rounded">
              <p className="text-2xl font-bold text-green-600">
                {analytics?.actionBreakdown.adjusted || 0}
              </p>
              <p className="text-sm text-muted-foreground">Auto-Adjusted</p>
            </div>
            <div className="text-center p-4 border rounded">
              <p className="text-2xl font-bold text-blue-600">
                {analytics?.actionBreakdown.override || 0}
              </p>
              <p className="text-sm text-muted-foreground">Manual Override</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">MOQ Optimization Recommendations:</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• Consider adjusting MOQ for frequently violated products</li>
              <li>• Implement bundle discounts to encourage higher quantities</li>
              <li>• Add MOQ warnings at product level to reduce cart violations</li>
              <li>• Monitor revenue impact of MOQ adjustments vs. lost sales</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};