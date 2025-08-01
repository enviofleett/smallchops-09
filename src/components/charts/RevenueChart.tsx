
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueChartProps {
  data?: Array<{ day: string; name: string; revenue: number; orders?: number }>;
  isLoading?: boolean;
}

const RevenueChart = ({ data, isLoading }: RevenueChartProps) => {
  const chartData = data && Array.isArray(data) && data.length > 0 
    ? data.map(item => ({
        name: item.day || item.name || 'Day',
        revenue: Number(item.revenue) || 0
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
          <div className="text-gray-400 text-sm">No revenue data available</div>
          <div className="text-gray-300 text-xs mt-1">Complete some orders to see revenue trends</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
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
            tickFormatter={(value) => `₦${value}`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}
            formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Revenue']}
          />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            stroke="url(#gradient)"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
          />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
