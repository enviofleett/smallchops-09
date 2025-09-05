
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface DashboardCustomer {
  id?: string;
  name?: string;
  customer_name?: string;
  email?: string;
  customer_email?: string;
  totalOrders?: number;
  orders?: number;
  totalSpent?: number;
  spending?: number;
  total_orders?: number;
  total_spent?: number;
}

interface TopCustomersChartProps {
  customers: DashboardCustomer[];
  type: 'orders' | 'spending';
  title: string;
}

export const TopCustomersChart = ({ customers, type, title }: TopCustomersChartProps) => {
  const data = customers.slice(0, 5).map(customer => {
    // Handle multiple API formats
    const customerName = customer.customer_name || customer.name || 'Unknown';
    const totalOrders = customer.orders || customer.totalOrders || customer.total_orders || 0;
    const totalSpent = customer.spending || customer.totalSpent || customer.total_spent || 0;
    
    return {
      name: customerName.split(' ')[0], // First name only for better display
      value: type === 'orders' ? totalOrders : totalSpent,
      fullName: customerName
    };
  });

  const formatValue = (value: number) => {
    return type === 'spending' ? `₦${value.toLocaleString()}` : value.toString();
  };

  if (customers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p className="text-muted-foreground">No customer data available</p>
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
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={type === 'spending' ? (value) => `₦${(value / 1000).toFixed(0)}k` : undefined}
            />
            <Tooltip 
              formatter={(value, name, props) => [
                formatValue(Number(value)), 
                type === 'orders' ? 'Orders' : 'Spent'
              ]}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            />
            <Bar 
              dataKey="value" 
              fill={type === 'orders' ? '#3B82F6' : '#8B5CF6'} 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
