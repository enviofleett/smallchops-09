import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  Package, 
  Eye, 
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Calendar,
  User,
  MapPin
} from 'lucide-react';
import { getOrders, OrderWithItems } from '@/api/orders';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useProductionMonitoring } from '@/hooks/useProductionMonitoring';
import { useToast } from '@/hooks/use-toast';

const OrdersSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4, 5].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

interface OrderCardProps {
  order: OrderWithItems;
  onView: (order: OrderWithItems) => void;
  onEdit: (order: OrderWithItems) => void;
}

const OrderCard = React.memo(({ order, onView, onEdit }: OrderCardProps) => {
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
      case 'ready':
        return 'bg-indigo-100 text-indigo-800';
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{order.customer_name || 'N/A'}</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-500">{order.customer_email}</span>
        </div>
        
        {order.order_type === 'delivery' && order.delivery_address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            <span className="text-gray-600 line-clamp-2">
              {typeof order.delivery_address === 'string' 
                ? order.delivery_address 
                : (order.delivery_address as any)?.address || 'Address not specified'
              }
            </span>
          </div>
        )}

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

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">
            Payment: {order.payment_status || 'pending'}
          </span>
          <span className="text-gray-500">
            Type: {order.order_type || 'N/A'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(order)}
          className="flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(order)}
          className="flex items-center gap-1"
        >
          <Edit className="w-3 h-3" />
          Edit
        </Button>
      </div>
    </Card>
  );
});

OrderCard.displayName = 'OrderCard';

export default function OrderManagement() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  const { reportError, reportOrderVisibilityIssue } = useProductionMonitoring();
  const { toast } = useToast();

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startTime = Date.now();
      const { orders: fetchedOrders, count } = await getOrders({
        page: 1,
        pageSize: 100,
        status: selectedStatus === 'all' ? 'all' : selectedStatus as any,
        searchQuery
      });
      
      const loadTime = Date.now() - startTime;
      
      // Log performance and potential issues
      console.log(`[ORDER_MANAGEMENT] Loaded ${fetchedOrders.length} orders in ${loadTime}ms`);
      
      if (fetchedOrders.length === 0) {
        await reportOrderVisibilityIssue({
          expected_orders: 'some',
          actual_orders: 0,
          status_filter: selectedStatus,
          search_query: searchQuery,
          total_count: count
        });
      }
      
      setOrders(fetchedOrders);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load orders';
      setError(errorMessage);
      await reportError(err instanceof Error ? err : new Error(errorMessage), 'order_management');
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        loadOrders();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        order?.order_number?.toLowerCase().includes(query) ||
        order?.customer_name?.toLowerCase().includes(query) ||
        order?.customer_email?.toLowerCase().includes(query) ||
        order?.status?.toLowerCase().includes(query)
      );
    });
  }, [orders, searchQuery]);

  const handleViewOrder = (order: OrderWithItems) => {
    console.log('View order:', order);
    // TODO: Implement order details modal
  };

  const handleEditOrder = (order: OrderWithItems) => {
    console.log('Edit order:', order);
    // TODO: Implement order edit functionality
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Order Management</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <OrdersSkeleton />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Order Management</h1>
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
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <Button variant="outline" size="icon" onClick={loadOrders}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {error && (
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <h3 className="font-semibold">Error Loading Orders</h3>
                <p className="text-sm">{error}</p>
              </div>
            </div>
            <Button onClick={loadOrders} variant="outline" className="mt-3">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </Card>
        )}

        {!error && filteredOrders.length === 0 && !loading && (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery 
                ? 'Try adjusting your search terms or filters'
                : 'No orders have been placed yet'
              }
            </p>
            <Button onClick={loadOrders} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </Card>
        )}

        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onView={handleViewOrder}
              onEdit={handleEditOrder}
            />
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}