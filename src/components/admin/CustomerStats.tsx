
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, Heart, ShoppingBag } from 'lucide-react';

export const CustomerStats = () => {
  const { data: customerStats, isLoading } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      // Get customer data from orders
      const { data: orders, error } = await supabase
        .from('orders_view')
        .select('customer_email, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      // Calculate unique customers
      const uniqueCustomers = new Set(orders.map(order => order.customer_email)).size;
      
      // Group by day for trend
      const dailyCustomers: { [key: string]: Set<string> } = {};
      orders.forEach(order => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        if (!dailyCustomers[date]) {
          dailyCustomers[date] = new Set();
        }
        dailyCustomers[date].add(order.customer_email);
      });
      
      // Convert to chart data
      const chartData = Object.entries(dailyCustomers)
        .map(([date, customers]) => ({
          date,
          customers: customers.size
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7); // Last 7 days
      
      return {
        totalCustomers: uniqueCustomers,
        newCustomersThisWeek: chartData.reduce((sum, day) => sum + day.customers, 0),
        chartData
      };
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Customer Statistics (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold">{customerStats?.totalCustomers || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Active This Week</p>
              <p className="text-2xl font-bold">{customerStats?.newCustomersThisWeek || 0}</p>
            </div>
          </div>
        </div>
        
        {customerStats?.chartData && customerStats.chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={customerStats.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="customers" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
