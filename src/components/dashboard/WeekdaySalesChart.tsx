import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyMetric {
  date: string;
  weekday?: string;
  revenue: number;
  orders: number;
}

interface WeekdaySalesChartProps {
  dailyData: DailyMetric[];
  isLoading?: boolean;
}

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_COLORS: { [key: string]: string } = {
  Monday: 'hsl(var(--primary))',
  Tuesday: 'hsl(var(--primary))',
  Wednesday: 'hsl(var(--primary))',
  Thursday: 'hsl(var(--primary))',
  Friday: 'hsl(var(--primary))',
  Saturday: 'hsl(var(--accent))',
  Sunday: 'hsl(var(--accent))',
};

export function WeekdaySalesChart({ dailyData, isLoading }: WeekdaySalesChartProps) {
  const weekdayData = useMemo(() => {
    const aggregated: { [key: string]: { sales: number; orders: number } } = {};

    // Initialize all weekdays
    WEEKDAY_ORDER.forEach(day => {
      aggregated[day] = { sales: 0, orders: 0 };
    });

    // Aggregate data by weekday with timezone-safe parsing
    dailyData.forEach(daily => {
      // Use provided weekday or calculate from date string (timezone-safe)
      let weekday = daily.weekday;
      
      if (!weekday && daily.date) {
        // Parse date as YYYY-MM-DD in LOCAL timezone (not UTC)
        // This ensures "2025-10-12" is always Sunday regardless of timezone
        const [year, month, day] = daily.date.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        weekday = localDate.toLocaleDateString('en-US', { weekday: 'long' });
      }
      
      if (weekday && aggregated[weekday]) {
        aggregated[weekday].sales += daily.revenue;
        aggregated[weekday].orders += daily.orders;
      }
    });

    // Convert to array in correct order
    return WEEKDAY_ORDER.map(day => ({
      day: day.substring(0, 3), // Mon, Tue, etc.
      fullDay: day,
      sales: aggregated[day].sales,
      orders: aggregated[day].orders,
    }));
  }, [dailyData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalSales = weekdayData.reduce((sum, day) => sum + day.sales, 0);
  const avgSales = weekdayData.length > 0 ? totalSales / weekdayData.length : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
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
              <Calendar className="h-5 w-5 text-primary" />
              Sales Comparison by Weekday
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total: {formatCurrency(totalSales)} • Avg: {formatCurrency(avgSales)}/day
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={weekdayData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="day"
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
              formatter={(value: number, name: string) => {
                if (name === 'sales') return [formatCurrency(value), 'Revenue'];
                return [value, 'Orders'];
              }}
              labelFormatter={(label) => {
                const day = weekdayData.find(d => d.day === label);
                return day ? day.fullDay : label;
              }}
            />
            <Bar
              dataKey="sales"
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
            >
              {weekdayData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={WEEKDAY_COLORS[entry.fullDay]}
                  opacity={entry.sales > avgSales ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
