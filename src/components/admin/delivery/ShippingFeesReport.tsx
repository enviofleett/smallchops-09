import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Package, Calendar, DollarSign } from 'lucide-react';
import { format, subWeeks, subMonths } from 'date-fns';

interface ReportBucket {
  start_date: string;
  end_date: string;
  total_shipping_fees: number;
  order_count: number;
  period_label: string;
}

interface ShippingFeesData {
  success: boolean;
  period: 'weekly' | 'monthly';
  buckets: ReportBucket[];
  total_fees: number;
  total_orders: number;
  date_range: {
    start: string;
    end: string;
  };
}

export const ShippingFeesReport: React.FC = () => {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  
  // Calculate default date range
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(
    period === 'weekly' ? subWeeks(new Date(), 4) : subMonths(new Date(), 6),
    'yyyy-MM-dd'
  );

  const { data: reportData, isLoading, error } = useQuery<ShippingFeesData>({
    queryKey: ['shipping-fees-report', period, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('shipping-fees-report', {
        body: {
          period,
          startDate,
          endDate
        }
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;

  const chartData = reportData?.buckets?.map(bucket => ({
    period: bucket.period_label,
    fees: bucket.total_shipping_fees,
    orders: bucket.order_count,
    shortLabel: period === 'weekly' 
      ? `Week ${format(new Date(bucket.start_date), 'MMM d')}`
      : format(new Date(bucket.start_date), 'MMM yyyy')
  })) || [];

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Failed to load shipping fees report</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error 
            ? error.message.includes('Invalid authorization') || error.message.includes('Admin access required')
              ? 'Access denied. Admin permissions required.'
              : error.message
            : 'Unknown error occurred'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Shipping Fees Report</h3>
        <Select value={period} onValueChange={(value: 'weekly' | 'monthly') => setPeriod(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </div>
              ))}
            </div>
            <div className="h-64 bg-muted rounded animate-pulse"></div>
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Total Fees</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(reportData.total_fees)}</p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Total Orders</span>
                </div>
                <p className="text-2xl font-bold">{reportData.total_orders}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Avg per Order</span>
                </div>
                <p className="text-2xl font-bold">
                  {reportData.total_orders > 0 
                    ? formatCurrency(reportData.total_fees / reportData.total_orders)
                    : '₦0'
                  }
                </p>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="shortLabel" 
                      fontSize={12}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      fontSize={12}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `₦${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'fees' ? formatCurrency(Number(value)) : value,
                        name === 'fees' ? 'Shipping Fees' : 'Orders'
                      ]}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Bar 
                      dataKey="fees" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No shipping fees data available for this period</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try selecting a different time period or check if there are paid delivery orders.
                </p>
              </div>
            )}

            {/* Period Details */}
            <div className="text-xs text-muted-foreground">
              <p>Period: {period === 'weekly' ? 'Last 4 weeks' : 'Last 6 months'}</p>
              <p>Date range: {format(new Date(startDate), 'MMM d, yyyy')} - {format(new Date(endDate), 'MMM d, yyyy')}</p>
              <p>Only includes paid delivery orders with delivery fees</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
};