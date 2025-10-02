import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface DailyAnalyticsData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
  topProducts: { name: string; quantity: number }[];
  growth: number;
  growthDirection: 'up' | 'down' | 'flat';
}

interface DailyAnalyticsTableProps {
  data?: {
    dailyData: DailyAnalyticsData[];
    summary: {
      totalDays: number;
      totalRevenue: number;
      totalOrders: number;
      totalCustomers: number;
      averageDailyRevenue: number;
      averageDailyOrders: number;
    };
  };
  isLoading?: boolean;
}

export const DailyAnalyticsTable: React.FC<DailyAnalyticsTableProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Business Intelligence</CardTitle>
          <CardDescription>Day-by-day analytics with revenue, customers, and product insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const dailyData = data?.dailyData || [];
  const summary = data?.summary;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getGrowthIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getGrowthColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle>Daily Business Intelligence</CardTitle>
        </div>
        <CardDescription>Day-by-day analytics with revenue, customers, and product insights</CardDescription>
        
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Days</p>
              <p className="text-lg font-semibold">{summary.totalDays}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.totalRevenue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-lg font-semibold">{summary.totalOrders}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Daily Revenue</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.averageDailyRevenue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Daily Orders</p>
              <p className="text-lg font-semibold">{summary.averageDailyOrders.toFixed(1)}</p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {dailyData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No daily analytics data available for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="min-w-[200px]">Top Products</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData.map((day, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {formatDate(day.date)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(day.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {day.orders}
                    </TableCell>
                    <TableCell className="text-right">
                      {day.customers}
                    </TableCell>
                    <TableCell>
                      {day.topProducts.length > 0 ? (
                        <div className="text-sm">
                          {day.topProducts.map((product, idx) => (
                            <div key={idx} className="text-muted-foreground">
                              {product.name} ({product.quantity})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getGrowthIcon(day.growthDirection)}
                        <span className={`text-sm font-medium ${getGrowthColor(day.growthDirection)}`}>
                          {day.growth !== 0 ? `${day.growth > 0 ? '+' : ''}${day.growth.toFixed(1)}%` : '-'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
