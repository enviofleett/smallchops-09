import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealTimeOrderList } from '@/hooks/useRealTimeOrderList';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { Package, Clock, MapPin, Truck } from 'lucide-react';
import type { OrderStatus } from '@/types/orders';

/**
 * Example component demonstrating real-time order list functionality
 * Shows live updates without manual refresh
 */
export const RealTimeOrdersExample: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState<('delivery' | 'pickup' | 'dine_in')[]>([]);

  // Use the real-time order list hook
  const {
    orders,
    isLoading,
    error,
    connectionStatus,
    lastUpdate,
    isConnected,
    refetch,
    getTotalOrders
  } = useRealTimeOrderList({
    filters: {
      status: statusFilter.length > 0 ? statusFilter : undefined,
      order_type: orderTypeFilter.length > 0 ? orderTypeFilter : undefined
    },
    limit: 20,
    enableAutoRefresh: true
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'default';
      case 'out_for_delivery': return 'default';
      case 'ready': return 'secondary';
      case 'preparing': return 'secondary';
      case 'confirmed': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'pickup': return <Package className="h-4 w-4" />;
      case 'dine_in': return <MapPin className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-destructive mb-4">Error loading orders: {error.message}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Orders ({getTotalOrders()})</h2>
          <p className="text-muted-foreground">Real-time order updates without refresh</p>
        </div>
        <RealTimeConnectionStatus
          connectionStatus={connectionStatus}
          lastUpdated={lastUpdate}
          compact={true}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select
          value={statusFilter.length > 0 ? statusFilter.join(',') : 'all'}
          onValueChange={(value) => {
            setStatusFilter(value === 'all' ? [] : value.split(',') as OrderStatus[]);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={orderTypeFilter.length > 0 ? orderTypeFilter.join(',') : 'all'}
          onValueChange={(value) => {
            setOrderTypeFilter(value === 'all' ? [] : value.split(',') as ('delivery' | 'pickup' | 'dine_in')[]);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="dine_in">Dine In</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getOrderTypeIcon(order.order_type)}
                    Order #{order.order_number}
                  </CardTitle>
                  <Badge variant={getStatusColor(order.status)}>
                    {order.status?.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{order.customer_name || 'Guest'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">₦{order.total_amount?.toLocaleString()}</p>  
                  </div>
                  <div>
                    <p className="text-muted-foreground">Items</p>
                    <p className="font-medium">{order.order_items?.length || 0} items</p>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  {order.order_delivery_schedule && (
                    <div className="md:col-span-3">
                      <p className="text-muted-foreground">Scheduled Delivery</p>
                      <p className="font-medium">
                        {new Date(order.order_delivery_schedule.delivery_date).toLocaleDateString()} 
                        {' at '}
                        {order.order_delivery_schedule.delivery_time_start} - {order.order_delivery_schedule.delivery_time_end}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {orders.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No orders found</p>
                <p className="text-muted-foreground">Orders will appear here automatically as they come in</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Connection Status Details */}
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-sm">Real-time Connection Details</CardTitle>
        </CardHeader>
        <CardContent>
          <RealTimeConnectionStatus
            connectionStatus={connectionStatus}
            lastUpdated={lastUpdate}
            showLastUpdated={true}
            compact={false}
          />
          <div className="mt-4 text-xs text-muted-foreground">
            <p>• Orders update automatically when status changes</p>
            <p>• Delivery schedules sync in real-time</p>
            <p>• No manual refresh needed</p>
            {!isConnected && <p className="text-amber-600">• Real-time updates paused</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};