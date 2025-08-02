import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TrendingUp, Truck, Receipt } from 'lucide-react';

interface RevenueBreakdownProps {
  data?: {
    stats?: {
      totalRevenue: number;
      totalOrders: number;
    };
    revenueBreakdown?: {
      productRevenue: number;
      shippingRevenue: number;
      taxRevenue: number;
    };
  };
  isLoading?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ data, isLoading }) => {
  // Mock data for demonstration - replace with actual data from your API
  const mockBreakdown = {
    productRevenue: data?.stats?.totalRevenue ? data.stats.totalRevenue * 0.8 : 800000,
    shippingRevenue: data?.stats?.totalRevenue ? data.stats.totalRevenue * 0.15 : 150000,
    taxRevenue: data?.stats?.totalRevenue ? data.stats.totalRevenue * 0.05 : 50000,
  };

  const breakdown = data?.revenueBreakdown || mockBreakdown;
  const totalRevenue = breakdown.productRevenue + breakdown.shippingRevenue + breakdown.taxRevenue;

  const chartData = [
    { name: 'Product Sales', value: breakdown.productRevenue, color: COLORS[0] },
    { name: 'Shipping Fees', value: breakdown.shippingRevenue, color: COLORS[1] },
    { name: 'Tax Revenue', value: breakdown.taxRevenue, color: COLORS[2] },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const formatPercentage = (value: number, total: number) => {
    return ((value / total) * 100).toFixed(1);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Revenue Breakdown
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Total Revenue: {formatCurrency(totalRevenue)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Breakdown Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Receipt className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">Product Sales</p>
                  <p className="text-sm text-blue-600">Core business revenue</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-900">{formatCurrency(breakdown.productRevenue)}</p>
                <p className="text-sm text-blue-600">{formatPercentage(breakdown.productRevenue, totalRevenue)}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Truck className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Shipping Fees</p>
                  <p className="text-sm text-green-600">Delivery zone charges</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-900">{formatCurrency(breakdown.shippingRevenue)}</p>
                <p className="text-sm text-green-600">{formatPercentage(breakdown.shippingRevenue, totalRevenue)}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Receipt className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-yellow-900">Tax Revenue</p>
                  <p className="text-sm text-yellow-600">8% VAT collected</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-yellow-900">{formatCurrency(breakdown.taxRevenue)}</p>
                <p className="text-sm text-yellow-600">{formatPercentage(breakdown.taxRevenue, totalRevenue)}%</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};