
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
  // Show fewer customers on mobile for better readability
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxCustomers = isMobile ? 3 : 5;
  
  const data = customers.slice(0, maxCustomers).map(customer => {
    // Handle multiple API formats
    const customerName = customer.customer_name || customer.name || 'Unknown';
    const totalOrders = customer.orders || customer.totalOrders || customer.total_orders || 0;
    const totalSpent = customer.spending || customer.totalSpent || customer.total_spent || 0;
    
    // Truncate names for mobile
    const displayName = isMobile 
      ? customerName.split(' ')[0].substring(0, 8) 
      : customerName.split(' ')[0];
    
    return {
      name: displayName,
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
          <div className="text-center py-6 sm:py-8">
            <Users className="mx-auto h-8 sm:h-12 w-8 sm:w-12 opacity-50 mb-3 sm:mb-4" />
            <p className="text-muted-foreground text-sm">No customer data available</p>
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
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              margin={{ 
                top: 20, 
                right: isMobile ? 10 : 30, 
                left: isMobile ? 10 : 20, 
                bottom: 5 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                tick={{ 
                  fontSize: isMobile ? 10 : 12, 
                  fill: "hsl(var(--foreground))" 
                }}
                interval={0}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 60 : 30}
              />
              <YAxis 
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickFormatter={type === 'spending' ? (value) => `₦${(value / 1000).toFixed(0)}k` : undefined}
                width={isMobile ? 40 : 60}
              />
              <Tooltip 
                formatter={(value, name, props) => [
                  formatValue(Number(value)), 
                  type === 'orders' ? 'Orders' : 'Spent'
                ]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: isMobile ? '12px' : '14px'
                }}
              />
              <Bar 
                dataKey="value" 
                fill={type === 'orders' ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
