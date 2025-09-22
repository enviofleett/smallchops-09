import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, DollarSign, Users, ShoppingCart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueBreakdownProps {
  data?: any;
  isLoading?: boolean;
}

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats || {};
  const revenueSeries = data?.revenueSeries || [];
  
  const averageOrderValue = stats.totalRevenue && stats.totalOrders 
    ? (stats.totalRevenue / Math.max(stats.totalOrders, 1))
    : 0;

  const metrics = [
    {
      label: 'Total Revenue',
      value: stats.totalRevenue || 0,
      icon: DollarSign,
      format: 'currency'
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders || 0,
      icon: ShoppingCart,
      format: 'number'
    },
    {
      label: 'Average Order Value',
      value: averageOrderValue,
      icon: Activity,
      format: 'currency'
    },
    {
      label: 'Total Customers',
      value: stats.totalCustomers || 0,
      icon: Users,
      format: 'number'
    }
  ];

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }
    return value.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Revenue Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            
            return (
              <div key={index} className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatValue(metric.value, metric.format)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Revenue Trends */}
        {revenueSeries.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3">Recent Revenue Trends</h4>
            <div className="space-y-2">
              {revenueSeries.slice(0, 5).map((trend: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded">
                  <span className="text-sm text-muted-foreground">
                    {trend.label}
                  </span>
                  <span className="text-sm font-medium">
                    {formatValue(trend.revenue || 0, 'currency')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Summary */}
        {stats.totalProducts > 0 && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Products Available</span>
              <span className="font-medium">{stats.totalProducts}</span>
            </div>
            {averageOrderValue > 0 && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Avg. Order Value</span>
                <span className="font-medium">{formatValue(averageOrderValue, 'currency')}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};