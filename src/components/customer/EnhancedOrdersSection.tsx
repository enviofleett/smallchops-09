import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ShoppingBag, 
  Search, 
  Filter,
  Download,
  Calendar
} from 'lucide-react';
import { OrderTrackingCard } from './OrderTrackingCard';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';

interface OrderFilters {
  status: OrderStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  search: string;
}

interface EnhancedOrdersSectionProps {
  orders: any[];
  isLoading: boolean;
  onViewDetails?: (orderId: string) => void;
  onReorder?: (order: any) => void;
  onTrackDelivery?: (orderId: string) => void;
  onDownloadReceipt?: (orderId: string) => void;
}

export function EnhancedOrdersSection({ 
  orders, 
  isLoading,
  onViewDetails,
  onReorder,
  onTrackDelivery,
  onDownloadReceipt
}: EnhancedOrdersSectionProps) {
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const filteredOrders = orders.filter(order => {
    if (filters.status !== 'all' && order.status !== filters.status) {
      return false;
    }
    if (filters.search && !order.order_number.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length,
    active: orders.filter(o => ['preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
    completed: orders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Orders</h2>
          <p className="text-muted-foreground">Track and manage your orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          {onDownloadReceipt && (
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Order Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{orderStats.total}</p>
            <p className="text-sm text-muted-foreground">Total Orders</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{orderStats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{orderStats.active}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{orderStats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search Orders</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by order number..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Order Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="text-sm"
                />
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="p-8 text-center">
          <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {filters.status !== 'all' || filters.search 
              ? 'No orders match your filters' 
              : 'No orders yet'
            }
          </h3>
          <p className="text-muted-foreground mb-4">
            {filters.status !== 'all' || filters.search
              ? 'Try adjusting your search criteria'
              : 'Start shopping to see your orders here'
            }
          </p>
          {(!filters.status || filters.status === 'all') && !filters.search && (
            <Button onClick={() => window.location.href = '/products'}>
              Start Shopping
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <OrderTrackingCard
              key={order.id}
              order={order}
              onViewDetails={onViewDetails}
              onReorder={onReorder}
              onTrackDelivery={onTrackDelivery}
            />
          ))}
        </div>
      )}
    </div>
  );
}