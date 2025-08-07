
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
}

interface TopCustomersChartProps {
  customers: DashboardCustomer[];
  type: 'orders' | 'spending';
  title: string;
}

export const TopCustomersChart = ({ customers, type, title }: TopCustomersChartProps) => {
  const data = customers.slice(0, 5).map(customer => {
    // Handle both API formats
    const customerName = customer.customer_name || customer.name || 'Unknown';
    const totalOrders = customer.orders || customer.totalOrders || 0;
    const totalSpent = customer.spending || customer.totalSpent || 0;
    
    return {
      name: customerName.split(' ')[0], // First name only for better display
      value: type === 'orders' ? totalOrders : totalSpent,
      fullName: customerName
    };
  });

  const formatValue = (value: number) => {
    return type === 'spending' ? `₦${value.toLocaleString()}` : value.toString();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
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
    </div>
  );
};
