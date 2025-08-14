import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Users, DollarSign } from 'lucide-react';
import { usePromotionAnalytics } from '@/hooks/usePromotionAnalytics';
import { formatCurrency } from '@/lib/discountCalculations';

interface PromotionUsageMonitorProps {
  className?: string;
}

export function PromotionUsageMonitor({ className }: PromotionUsageMonitorProps) {
  const { data, isLoading, error } = usePromotionAnalytics();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Promotion Usage Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Promotion Monitor Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load promotion data</p>
        </CardContent>
      </Card>
    );
  }

  const { metrics, summary } = data;

  return (
    <div className={className}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Usage</p>
                <p className="text-2xl font-bold">{summary.totalUsage}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Discounts</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalDiscount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Promotions</p>
                <p className="text-2xl font-bold">{summary.totalPromotions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Promotion Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Promotion Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map(metric => {
              const usagePercentage = metric.totalUsage > 0 
                ? Math.min((metric.totalUsage / 100) * 100, 100) 
                : 0;

              return (
                <div key={metric.promotionId} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{metric.promotionName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {metric.uniqueCustomers} unique customers
                      </p>
                    </div>
                    <Badge variant={metric.totalUsage > 50 ? 'default' : 'secondary'}>
                      {metric.totalUsage} uses
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Usage Activity</span>
                      <span>{usagePercentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Discount Given</p>
                      <p className="font-medium">{formatCurrency(metric.totalDiscount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Revenue Impact</p>
                      <p className="font-medium">{formatCurrency(metric.revenueImpact)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Avg Order</p>
                      <p className="font-medium">{formatCurrency(metric.averageOrderValue)}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {metrics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No active promotions found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}