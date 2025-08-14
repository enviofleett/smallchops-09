import React, { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  RefreshCw 
} from 'lucide-react';
import { useCustomerOrdersFixed } from '@/hooks/useCustomerOrdersFixed';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { ErrorBoundary } from '@/components/ui/error-boundary';

interface OrderCardProps {
  order: any;
  onViewDetails?: (order: any) => void;
}

const OrderCard = React.memo(({ order, onViewDetails }: OrderCardProps) => {
  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '₦0';
    return `₦${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Card className="p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold mb-1">
            Order #{order.order_number || 'N/A'}
          </h3>
          <p className="text-sm text-gray-500">
            {formatDate(order.created_at)}
          </p>
        </div>
        <Badge className={`px-2 py-1 text-xs ${getStatusColor(order.status)}`}>
          {(order.status || 'unknown').replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Items:</span>
          <span className="text-sm font-medium">
            {order.order_items?.length || 0} item(s)
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total:</span>
          <span className="text-lg font-bold">
            {formatCurrency(order.total_amount)}
          </span>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Payment: {order.payment_status || 'pending'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails?.(order)}
            className="flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View Details
          </Button>
        </div>
      </div>
    </Card>
  );
});

OrderCard.displayName = 'OrderCard';

const OrdersSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    ))}
  </div>
);

export function EnhancedOrdersSection() {
  const { customerAccount, user } = useCustomerAuth();
  const customerEmail = user?.email || customerAccount?.email;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const { 
    data: orders, 
    isLoading, 
    error, 
    refetch 
  } = useCustomerOrdersFixed(customerEmail);

  const filteredOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    
    return orders.filter(order => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        order?.order_number?.toLowerCase().includes(query) ||
        order?.status?.toLowerCase().includes(query)
      );
    });
  }, [orders, searchQuery]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Orders</h2>
          <Skeleton className="h-10 w-32" />
        </div>
        <OrdersSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load orders</h3>
        <p className="text-gray-500 mb-4">
          {error instanceof Error ? error.message : 'Something went wrong'}
        </p>
        <Button onClick={handleRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
        <p className="text-gray-500 mb-4">
          When you place your first order, it will appear here.
        </p>
        <Button onClick={() => window.location.href = '/'}>
          Start Shopping
        </Button>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">My Orders</h2>
            <p className="text-gray-500">
              {filteredOrders.length} order(s) found
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onViewDetails={setSelectedOrder}
            />
          ))}
        </div>

        {filteredOrders.length === 0 && searchQuery && (
          <Card className="p-8 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No matching orders</h3>
            <p className="text-gray-500">
              Try adjusting your search terms
            </p>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}