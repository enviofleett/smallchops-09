import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
  guestCheckouts?: number;
  registeredCheckouts?: number;
}

interface WeeklySalesComparisonProps {
  dailyData: DailyMetric[];
  isLoading?: boolean;
}

// Helper to get ISO week number
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WeeklySalesComparison({ dailyData, isLoading }: WeeklySalesComparisonProps) {
  const weeklyData = useMemo(() => {
    // Group by ISO week number
    const weekMap: { [weekKey: string]: { revenue: number; orders: number; startDate: string; endDate: string } } = {};
    
    dailyData.forEach(day => {
      const date = new Date(day.date);
      const weekNum = getISOWeek(date);
      const year = date.getFullYear();
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
      
      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          revenue: 0,
          orders: 0,
          startDate: day.date,
          endDate: day.date
        };
      }
      
      weekMap[weekKey].revenue += day.revenue;
      weekMap[weekKey].orders += day.orders;
      weekMap[weekKey].endDate = day.date;
    });
    
    // Convert to array and calculate growth
    const weeks = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, data], index, array) => {
        const previousWeek = index > 0 ? array[index - 1][1] : null;
        const growth = previousWeek && previousWeek.revenue > 0
          ? ((data.revenue - previousWeek.revenue) / previousWeek.revenue) * 100
          : 0;
        
        return {
          week: `Week ${index + 1}`,
          weekLabel: `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`,
          revenue: data.revenue,
          orders: data.orders,
          growth,
          isPositiveGrowth: growth >= 0
        };
      });
    
    return weeks;
  }, [dailyData]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalRevenue = weeklyData.reduce((sum, week) => sum + week.revenue, 0);
  const avgWeeklyRevenue = weeklyData.length > 0 ? totalRevenue / weeklyData.length : 0;

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

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Weekly Sales Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No weekly data available for the selected period
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Weekly Sales Comparison
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {weeklyData.length} weeks • Avg: {formatCurrency(avgWeeklyRevenue)}/week
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="week" 
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
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload;
                
                return (
                  <div className="bg-card p-3 rounded-lg border shadow-lg">
                    <p className="font-semibold mb-2">{data.week}</p>
                    <p className="text-xs text-muted-foreground mb-2">{data.weekLabel}</p>
                    <p className="text-sm">Revenue: {formatCurrency(data.revenue)}</p>
                    <p className="text-sm">Orders: {data.orders}</p>
                    {data.growth !== 0 && (
                      <p className={`text-sm flex items-center gap-1 mt-2 pt-2 border-t ${data.isPositiveGrowth ? 'text-emerald-600' : 'text-red-600'}`}>
                        {data.isPositiveGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {data.isPositiveGrowth ? '+' : ''}{data.growth.toFixed(1)}% vs previous week
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="revenue" radius={[8, 8, 0, 0]} animationDuration={1000}>
              {weeklyData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isPositiveGrowth ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                  opacity={entry.revenue > avgWeeklyRevenue ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
