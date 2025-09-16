
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface OrdersChartProps {
  data?: Array<{ day: string; name: string; orders: number; revenue?: number }>;
  isLoading?: boolean;
}

const OrdersChart = ({ data, isLoading }: OrdersChartProps) => {
  console.log('OrdersChart - received data:', data);
  
  const chartData = data && Array.isArray(data) && data.length > 0 
    ? data.map(item => ({
        name: item.day || item.name || 'Day',
        orders: Number(item.orders) || 0
      }))
    : [];

  if (isLoading) {
    return (
      <div className="h-64">
        <Skeleton className="w-full h-full rounded" />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-sm">No order data available</div>
          <div className="text-gray-300 text-xs mt-1">Start taking orders to see trends</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}
            formatter={(value) => [`${value}`, 'Orders']}
          />
          <Bar 
            dataKey="orders" 
            fill="url(#barGradient)"
            radius={[4, 4, 0, 0]}
          />
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OrdersChart;
