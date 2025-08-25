
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { OrderDetailsModal } from '@/components/admin/OrderDetailsModal';
import { useOrders } from '@/hooks/useOrders';
import { useOrderActions } from '@/hooks/useOrderActions';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { Search, Package, Filter, RefreshCw } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge';

export const OrderManagement = () => {
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const pageSize = 10;

  const {
    orders,
    loading,
    error,
    totalCount,
    refetch
  } = useOrders({
    page,
    pageSize,
    status: selectedStatus,
    searchQuery,
    startDate: dateRange?.from?.toISOString().split('T')[0],
    endDate: dateRange?.to?.toISOString().split('T')[0]
  });

  const { updateOrderStatus, deleteOrder, isUpdating } = useOrderActions();

  const selectedOrder = useMemo(() => {
    return orders.find(order => order.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      await refetch();
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      try {
        await deleteOrder(orderId);
        await refetch();
      } catch (error) {
        console.error('Failed to delete order:', error);
      }
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Status summary counts
  const statusCounts = useMemo(() => {
    const counts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return counts;
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">Manage and track all customer orders</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'] as OrderStatus[]).map((status) => (
          <Card key={status} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStatus(status)}>
            <CardContent className="p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <AdminOrderStatusBadge status={status} />
                <div className="text-2xl font-bold">{statusCounts[status] || 0}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as OrderStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
            />

            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedStatus('all');
                setSearchQuery('');
                setDateRange(undefined);
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Orders ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersTable
            orders={orders}
            loading={loading}
            onStatusChange={handleStatusChange}
            onDelete={handleDeleteOrder}
            onViewDetails={setSelectedOrderId}
            isUpdating={isUpdating}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({totalCount} total orders)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};
