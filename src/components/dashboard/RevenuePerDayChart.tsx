import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyMetric {
  date: string;
  weekday?: string;
  revenue: number;
  orders: number;
  guestCheckouts?: number;
  registeredCheckouts?: number;
  firstTimeOrders?: number;
}

interface RevenuePerDayChartProps {
  dailyData: DailyMetric[];
  isLoading?: boolean;
}

export function RevenuePerDayChart({ dailyData, isLoading }: RevenuePerDayChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalRevenue = dailyData.reduce((sum, day) => sum + day.revenue, 0);
  const avgRevenue = dailyData.length > 0 ? totalRevenue / dailyData.length : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Revenue Per Day
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total: {formatCurrency(totalRevenue)} • Avg: {formatCurrency(avgRevenue)}/day
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={dailyData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              labelFormatter={(label) => {
                const day = dailyData.find(d => d.date === label);
                return day ? `${day.weekday || ''} ${formatDate(label)}` : label;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
