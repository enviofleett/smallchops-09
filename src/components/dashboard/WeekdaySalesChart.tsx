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
  startDate?: string;
  endDate?: string;
}

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Get today's weekday for highlighting
const getTodayWeekday = () => {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
};

export function WeekdaySalesChart({ dailyData, isLoading, startDate, endDate }: WeekdaySalesChartProps) {
  // Determine if we should show weekly view (30+ days range)
  const isWeeklyView = useMemo(() => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 25; // Use weekly view for 25+ days
  }, [startDate, endDate]);

  const chartData = useMemo(() => {
    if (isWeeklyView && startDate) {
      // Group by weeks for 30-day view
      const weeklyAggregated: { [key: string]: { sales: number; orders: number } } = {};
      const startDateObj = new Date(startDate);
      
      dailyData.forEach(daily => {
        const [year, month, day] = daily.date.split('-').map(Number);
        const dailyDate = new Date(year, month - 1, day);
        
        // Calculate week number from start date
        const daysDiff = Math.ceil((dailyDate.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(daysDiff / 7) + 1;
        const weekKey = `Week ${weekNum}`;
        
        if (!weeklyAggregated[weekKey]) {
          weeklyAggregated[weekKey] = { sales: 0, orders: 0 };
        }
        
        weeklyAggregated[weekKey].sales += daily.revenue;
        weeklyAggregated[weekKey].orders += daily.orders;
      });
      
      // Convert to array and sort by week number
      return Object.entries(weeklyAggregated)
        .map(([week, data]) => ({
          day: week,
          fullDay: week,
          sales: data.sales,
          orders: data.orders,
          isCurrentWeek: false, // We'll set this based on current date
        }))
        .sort((a, b) => {
          const aNum = parseInt(a.day.split(' ')[1]);
          const bNum = parseInt(b.day.split(' ')[1]);
          return aNum - bNum;
        });
    } else {
      // Original weekday grouping for shorter periods
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
    }
  }, [dailyData, isWeeklyView, startDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalSales = chartData.reduce((sum, day) => sum + day.sales, 0);
  const avgSales = chartData.length > 0 ? totalSales / chartData.length : 0;
  const todayWeekday = getTodayWeekday();

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
              {isWeeklyView ? 'Weekly Revenue Comparison' : 'Sales Comparison by Weekday'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total: {formatCurrency(totalSales)} • Avg: {formatCurrency(avgSales)}/{isWeeklyView ? 'week' : 'day'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
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
                const day = chartData.find(d => d.day === label);
                return day ? day.fullDay : label;
              }}
            />
            <Bar
              dataKey="sales"
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
            >
              {chartData.map((entry, index) => {
                const isToday = !isWeeklyView && entry.fullDay === todayWeekday;
                const baseColor = isToday ? '#84cc16' : 'hsl(var(--primary))'; // Lemon green for today
                
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={baseColor}
                    opacity={isToday ? 1 : (entry.sales > avgSales ? 1 : 0.7)}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
