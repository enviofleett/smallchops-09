import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';
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
  const revenueTrends = data?.revenueTrends || [];
  const orderTrends = data?.orderTrends || [];

  // Calculate percentage changes (mock data for demo)
  const revenueChange = 15.2;
  const ordersChange = 8.7;
  const customersChange = 12.3;
  const averageOrderValue = stats.totalRevenue && stats.totalOrders 
    ? (stats.totalRevenue / Math.max(stats.totalOrders, 1))
    : 0;

  const metrics = [
    {
      label: 'Total Revenue',
      value: stats.totalRevenue || 0,
      change: revenueChange,
      icon: DollarSign,
      format: 'currency'
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders || 0,
      change: ordersChange,
      icon: Activity,
      format: 'number'
    },
    {
      label: 'Average Order Value',
      value: averageOrderValue,
      change: 5.8,
      icon: TrendingUp,
      format: 'currency'
    },
    {
      label: 'Total Customers',
      value: stats.totalCustomers || 0,
      change: customersChange,
      icon: TrendingUp,
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
            const isPositive = metric.change > 0;
            
            return (
              <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatValue(metric.value, metric.format)}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{Math.abs(metric.change)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Revenue Trends */}
        {revenueTrends.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3">Recent Revenue Trends</h4>
            <div className="space-y-2">
              {revenueTrends.slice(0, 5).map((trend: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(trend.date).toLocaleDateString()}
                  </span>
                  <span className="font-medium">
                    {formatValue(trend.revenue || 0, 'currency')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Insights */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <h4 className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
            Quick Insights
          </h4>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Revenue growth trending upward this month</li>
            <li>• Customer acquisition rate increased by {customersChange.toFixed(1)}%</li>
            <li>• Average order value showing positive momentum</li>
            {stats.totalProducts && (
              <li>• {stats.totalProducts} products currently available</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};