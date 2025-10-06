import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useTopProducts, useProductTrends } from '@/hooks/useAdvancedReports';

interface ProductTrendsChartProps {
  startDate: Date;
  endDate: Date;
  interval: 'day' | 'week' | 'month';
}

export function ProductTrendsChart({ startDate, endDate, interval }: ProductTrendsChartProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  const { data: topProducts, isLoading: productsLoading } = useTopProducts(startDate, endDate, 10);
  const { data: trendsData, isLoading: trendsLoading } = useProductTrends(
    selectedProductId,
    startDate,
    endDate,
    interval
  );

  const chartData = trendsData?.map(item => ({
    date: format(parseISO(item.interval_start), 'MMM d'),
    units: Number(item.units_sold),
    revenue: Number(item.revenue),
    orders: Number(item.orders_count),
  })) || [];

  if (productsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Product Sales Trends</CardTitle>
          <Select value={selectedProductId || ''} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {topProducts?.map(product => (
                <SelectItem key={product.product_id} value={product.product_id}>
                  {product.product_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedProductId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a product to view sales trends
          </div>
        ) : trendsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No trend data available for this product
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'revenue') return `₦${value.toLocaleString()}`;
                  return value;
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="units"
                stroke="hsl(var(--primary))"
                name="Units Sold"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-2))"
                name="Revenue (₦)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}