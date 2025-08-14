import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Filter, 
  Package, 
  Eye, 
  Edit,
  Truck,
  RefreshCw,
  AlertTriangle,
  Calendar,
  User,
  MapPin,
  Clock,
  CreditCard,
  ChevronDown
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

const MobileOrderCard = React.memo(({ order, onView, onEdit }: OrderCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'out_for_delivery':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'preparing':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'confirmed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ready':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
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
    <Card className="border border-border/50 bg-card hover:shadow-sm transition-all duration-200">
      <div className="p-4 space-y-3">
        {/* Header with Order Number and Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">
              #{order.order_number || 'N/A'}
            </span>
          </div>
          <Badge className={`px-2 py-1 text-xs font-medium border ${getStatusColor(order.status)}`}>
            {(order.status || 'unknown').replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDate(order.created_at)}</span>
        </div>

        {/* Customer Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">{order.customer_name || 'N/A'}</span>
          </div>
          <div className="text-xs text-muted-foreground pl-6">
            {order.customer_email}
          </div>
        </div>

        {/* Items and Total */}
        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{order.order_items?.length || 0} Items</span>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm">{formatCurrency(order.total_amount)}</div>
          </div>
        </div>

        {/* Delivery Schedule */}
        {order.order_type === 'delivery' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Delivery Schedule</span>
            </div>
            <div className="text-xs text-orange-700">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Schedule Pending</span>
              </div>
              <div className="text-orange-600 mt-1">Will be assigned soon</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(order)}
            className="flex-1 h-8 text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(order)}
            className="flex-1 h-8 text-xs"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
});

MobileOrderCard.displayName = 'MobileOrderCard';

export default function OrderManagement() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
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
        reportOrderVisibilityIssue('no_orders_found', {
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
    let filtered = orders;
    
    // Filter by status if not 'all'
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order?.order_number?.toLowerCase().includes(query) ||
        order?.customer_name?.toLowerCase().includes(query) ||
        order?.customer_email?.toLowerCase().includes(query) ||
        order?.status?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [orders, searchQuery, selectedStatus]);

  const getOrderCounts = useMemo(() => {
    const counts = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0
    };
    
    orders.forEach(order => {
      const status = order.status || 'pending';
      if (status in counts) {
        counts[status as keyof typeof counts]++;
      }
    });
    
    return counts;
  }, [orders]);

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
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-lg">Orders</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" 
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="lg:hidden"
              >
                <Filter className="w-4 h-4 mr-1" />
                Filter
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" size="sm" onClick={loadOrders}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>

          {/* Mobile Filter Dropdown */}
          {isFilterOpen && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border lg:hidden">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStatus('all')}
                  className="text-xs h-8"
                >
                  All Dates
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8">
                  All Times
                </Button>
              </div>
              <div className="mt-2">
                <Button
                  variant={selectedStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStatus('all')}
                  className="text-xs h-8 w-full"
                >
                  All Orders
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status Tabs */}
        <div className="px-4 py-3 bg-muted/20 border-b border-border">
          <ScrollArea className="w-full">
            <div className="flex gap-1 pb-2">
              <Button
                variant={selectedStatus === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus('all')}
                className="flex-shrink-0 h-8 px-3 text-xs font-medium"
              >
                All Orders ({getOrderCounts.all})
              </Button>
              <Button
                variant={selectedStatus === 'pending' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus('pending')}
                className="flex-shrink-0 h-8 px-3 text-xs font-medium"
              >
                Pending ({getOrderCounts.pending})
              </Button>
              <Button
                variant={selectedStatus === 'confirmed' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus('confirmed')}
                className="flex-shrink-0 h-8 px-3 text-xs font-medium"
              >
                Confirmed ({getOrderCounts.confirmed})
              </Button>
              <Button
                variant={selectedStatus === 'preparing' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus('preparing')}
                className="flex-shrink-0 h-8 px-3 text-xs font-medium"
              >
                Preparing ({getOrderCounts.preparing})
              </Button>
              <Button
                variant={selectedStatus === 'out_for_delivery' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus('out_for_delivery')}
                className="flex-shrink-0 h-8 px-3 text-xs font-medium"
              >
                For Delivery ({getOrderCounts.out_for_delivery})
              </Button>
              <Button
                variant={selectedStatus === 'delivered' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus('delivered')}
                className="flex-shrink-0 h-8 px-3 text-xs font-medium"
              >
                Delivered ({getOrderCounts.delivered})
              </Button>
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && <OrdersSkeleton />}
          
          {error && (
            <Card className="p-6 border-destructive/50 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
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

          {!error && !loading && filteredOrders.length === 0 && (
            <Card className="p-8 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-muted-foreground mb-4">
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

          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <MobileOrderCard
                key={order.id}
                order={order}
                onView={handleViewOrder}
                onEdit={handleEditOrder}
              />
            ))}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}