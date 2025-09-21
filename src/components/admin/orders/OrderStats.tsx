import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface OrderStatsProps {
  orders: any[];
}

export function OrderStats({ orders }: OrderStatsProps) {
  const stats = React.useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalRevenue,
      pending: statusCounts.pending || 0,
      confirmed: statusCounts.confirmed || 0,
      preparing: statusCounts.preparing || 0,
      ready: statusCounts.ready || 0,
      outForDelivery: statusCounts.out_for_delivery || 0,
      delivered: statusCounts.delivered || 0
    };
  }, [orders]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalOrders}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Preparing:</span>
              <Badge variant="secondary">{stats.preparing}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Ready:</span>
              <Badge variant="secondary">{stats.ready}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Out for Delivery:</span>
              <Badge variant="secondary">{stats.outForDelivery}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Pending:</span>
              <Badge variant="outline">{stats.pending}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Confirmed:</span>
              <Badge variant="outline">{stats.confirmed}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Delivered:</span>
              <Badge variant="outline">{stats.delivered}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}