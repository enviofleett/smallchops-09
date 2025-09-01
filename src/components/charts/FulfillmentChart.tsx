
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface FulfillmentChartProps {
  data?: Array<{ 
    week: string; 
    delivery: number; 
    pickup: number;
    total: number;
  }>;
  isLoading?: boolean;
}

const FulfillmentChart = ({ data, isLoading }: FulfillmentChartProps) => {
  console.log('FulfillmentChart - received data:', data);
  
  const chartData = data && Array.isArray(data) && data.length > 0 
    ? data.map(item => ({
        week: item.week || 'Week',
        delivery: Number(item.delivery) || 0,
        pickup: Number(item.pickup) || 0,
        total: Number(item.total) || 0
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
          <div className="text-gray-400 text-sm">No fulfillment data available</div>
          <div className="text-gray-300 text-xs mt-1">Complete some orders to see fulfillment trends</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="week" 
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
            formatter={(value, name) => [
              `${Number(value).toLocaleString()} orders`, 
              name === 'delivery' ? 'Delivery' : 'Pickup'
            ]}
          />
          <Legend />
          <Bar 
            dataKey="delivery" 
            fill="#3b82f6" 
            name="Delivery"
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="pickup" 
            fill="#10b981" 
            name="Pickup"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FulfillmentChart;
