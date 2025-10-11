import React, { useMemo } from 'react';
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
  startDate: string;
  endDate: string;
  isLoading?: boolean;
}

// Helper to fill missing days with zero data
const fillMissingDays = (data: DailyMetric[], startDate: string, endDate: string): DailyMetric[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const filledData: DailyMetric[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const existing = data.find(item => item.date === dateKey);
    
    if (existing) {
      filledData.push(existing);
    } else {
      // Add zero-revenue day
      filledData.push({
        date: dateKey,
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        revenue: 0,
        orders: 0,
        guestCheckouts: 0,
        registeredCheckouts: 0,
        firstTimeOrders: 0
      });
    }
  }
  
  return filledData;
};

export function RevenuePerDayChart({ dailyData, startDate, endDate, isLoading }: RevenuePerDayChartProps) {
  // Fill missing days and enrich with guest/registered breakdown
  const enrichedData = useMemo(() => {
    const filled = fillMissingDays(dailyData, startDate, endDate);
    
    return filled.map(day => {
      // Calculate guest and registered revenue (proportional split)
      const guestRatio = day.orders > 0 ? (day.guestCheckouts || 0) / day.orders : 0;
      const registeredRatio = day.orders > 0 ? (day.registeredCheckouts || 0) / day.orders : 0;
      
      return {
        ...day,
        guestRevenue: day.revenue * guestRatio,
        registeredRevenue: day.revenue * registeredRatio
      };
    });
  }, [dailyData, startDate, endDate]);

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

  const totalRevenue = enrichedData.reduce((sum, day) => sum + day.revenue, 0);
  const totalGuestRevenue = enrichedData.reduce((sum, day) => sum + day.guestRevenue, 0);
  const totalRegisteredRevenue = enrichedData.reduce((sum, day) => sum + day.registeredRevenue, 0);
  const avgRevenue = enrichedData.length > 0 ? totalRevenue / enrichedData.length : 0;

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
              Daily Revenue Breakdown
            </CardTitle>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-sm text-muted-foreground">
                Total: {formatCurrency(totalRevenue)} • Avg: {formatCurrency(avgRevenue)}/day
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(217, 91%, 60%)' }} />
                  Guest: {formatCurrency(totalGuestRevenue)}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
                  Registered: {formatCurrency(totalRegisteredRevenue)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={enrichedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="guestGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="registeredGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
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
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                
                return (
                  <div className="bg-card p-3 rounded-lg border shadow-lg">
                    <p className="font-semibold mb-2">{data.weekday} {formatDate(data.date)}</p>
                    <p className="text-sm" style={{ color: 'hsl(217, 91%, 60%)' }}>
                      Guest: {formatCurrency(data.guestRevenue)}
                    </p>
                    <p className="text-sm" style={{ color: 'hsl(142, 76%, 36%)' }}>
                      Registered: {formatCurrency(data.registeredRevenue)}
                    </p>
                    <p className="text-sm font-semibold mt-1 pt-1 border-t">
                      Total: {formatCurrency(data.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.orders} orders ({data.guestCheckouts} guest • {data.registeredCheckouts} registered)
                    </p>
                  </div>
                );
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="guestRevenue"
              name="Guest Revenue"
              stackId="1"
              stroke="hsl(217, 91%, 60%)"
              fill="url(#guestGradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="registeredRevenue"
              name="Registered Revenue"
              stackId="1"
              stroke="hsl(142, 76%, 36%)"
              fill="url(#registeredGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
