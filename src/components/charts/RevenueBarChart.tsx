import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueBarChartProps {
  data?: Array<{ label: string; revenue: number; orders: number }>;
  isLoading?: boolean;
}

const RevenueBarChart: React.FC<RevenueBarChartProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data || [];

  // If no data, show empty state
  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No revenue data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Data is already in the correct format
  const formattedData = chartData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="label" 
              fontSize={12}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              fontSize={12}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `₦${value.toLocaleString()}`}
            />
            <Tooltip 
              formatter={(value, name) => [
                name === 'revenue' 
                  ? `₦${Number(value).toLocaleString()}`
                  : value,
                name === 'revenue' ? 'Revenue' : 'Orders'
              ]}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar 
              dataKey="revenue" 
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RevenueBarChart;