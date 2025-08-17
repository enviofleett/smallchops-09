import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Package, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { useOptimizedMonitoring } from '@/hooks/useOptimizedMonitoring';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { supabase } from '@/integrations/supabase/client';

const AdminOrders = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'with_schedule' | 'without_schedule'>('all');

  // Fetch orders with optimized monitoring
  const { data: ordersResponse, isLoading, error, refetch } = useOptimizedMonitoring(
    ['admin-orders', activeTab, debouncedSearchQuery, currentPage.toString()],
    () => getOrders({
      page: currentPage,
      pageSize: 10,
      status: activeTab === 'all' ? undefined : activeTab as any,
      searchQuery: debouncedSearchQuery || undefined
    }),
    {
      type: 'dashboard',
      priority: 'medium',
      enabled: true
    }
  );

  const orders = ordersResponse?.orders || [];
  const totalOrders = ordersResponse?.count || 0;
  const totalPages = Math.ceil(totalOrders / 10);

  // Get order IDs for delivery schedules
  const orderIds = useMemo(() => orders.map(order => order.id), [orders]);
  
  // Fetch delivery schedules for displayed orders
  const { schedules: deliverySchedules } = useOrderDeliverySchedules(orderIds);

  // Filter orders based on delivery schedule presence
  const filteredOrders = useMemo(() => {
    if (deliveryFilter === 'all') return orders;
    
    const ordersWithSchedules = new Set(
      Object.values(deliverySchedules || {}).map(schedule => schedule.order_id) || []
    );

    return orders.filter(order => {
      const hasSchedule = ordersWithSchedules.has(order.id);
      return deliveryFilter === 'with_schedule' ? hasSchedule : !hasSchedule;
    });
  }, [orders, deliverySchedules, deliveryFilter]);

  const handleSearch = () => {
    setCurrentPage(1);
    // No need to manually refetch, debounced query will trigger automatically
  };

  const handleOrderClick = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsOrderDialogOpen(true);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentPage(1);
  };

  // Quick stats
  const stats = useMemo(() => {
    if (!orders.length) return { pending: 0, preparing: 0, ready: 0, outForDelivery: 0, delivered: 0 };
    
    return orders.reduce((acc, order) => {
      switch (order.status) {
        case 'pending':
          acc.pending++;
          break;
        case 'preparing':
          acc.preparing++;
          break;
        case 'ready':
          acc.ready++;
          break;
        case 'out_for_delivery':
          acc.outForDelivery++;
          break;
        case 'delivered':
          acc.delivered++;
          break;
      }
      return acc;
    }, { pending: 0, preparing: 0, ready: 0, outForDelivery: 0, delivered: 0 });
  }, [orders]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Orders Management</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Error loading orders: {error.message}</p>
            <Button onClick={() => refetch()} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Orders Management</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={handleSearch}>Search</Button>
          <Button variant="outline">
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Preparing</p>
                <p className="text-2xl font-bold">{stats.preparing}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Ready</p>
                <p className="text-2xl font-bold">{stats.ready}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Out for Delivery</p>
                <p className="text-2xl font-bold">{stats.outForDelivery}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Delivered</p>
                <p className="text-2xl font-bold">{stats.delivered}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All Orders ({totalOrders})</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="preparing">Preparing</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="out_for_delivery">Out for Delivery</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Delivery Filter */}
          <div className="flex gap-2">
            <Button
              variant={deliveryFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDeliveryFilter('all')}
            >
              All Orders
            </Button>
            <Button
              variant={deliveryFilter === 'with_schedule' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDeliveryFilter('with_schedule')}
            >
              Scheduled
            </Button>
            <Button
              variant={deliveryFilter === 'without_schedule' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDeliveryFilter('without_schedule')}
            >
              Unscheduled
            </Button>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <AdminOrderCard
                key={order.id}
                order={order}
                onOrderClick={handleOrderClick}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      {selectedOrder && (
        <OrderDetailsDialog
          isOpen={isOrderDialogOpen}
          onClose={() => {
            setIsOrderDialogOpen(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  );
};

interface AdminOrderCardProps {
  order: OrderWithItems;
  onOrderClick: (order: OrderWithItems) => void;
}

const AdminOrderCard = ({ order, onOrderClick }: AdminOrderCardProps) => {
  const [showProductDetails, setShowProductDetails] = useState(false);
  
  // Use delivery zone data from the main orders payload instead of separate query
  const deliveryZoneName = order.delivery_zones?.name || 'Unknown Zone';
  
  // Only fetch detailed order data when needed
  const { data: detailedOrder } = useDetailedOrderData(order.id, {
    enabled: showProductDetails
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'out_for_delivery': return 'bg-orange-100 text-orange-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
              <Badge className={getStatusBadgeColor(order.status)}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Customer:</strong> {order.customer_name}</p>
              <p><strong>Email:</strong> {order.customer_email}</p>
              {order.customer_phone && (
                <p><strong>Phone:</strong> {order.customer_phone}</p>
              )}
              <p><strong>Type:</strong> {order.order_type}</p>
              <p><strong>Total:</strong> {formatCurrency(order.total_amount)}</p>
              <p><strong>Items:</strong> {order.order_items?.length || 0}</p>
              
              {order.order_type === 'delivery' && order.delivery_zone_id && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Delivery to {deliveryZoneName}
                  </p>
                  {order.delivery_address && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {typeof order.delivery_address === 'string' 
                        ? order.delivery_address 
                        : JSON.stringify(order.delivery_address)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOrderClick(order)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View Details
            </Button>
            
            <button
              onClick={() => setShowProductDetails(!showProductDetails)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showProductDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>

        {showProductDetails && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <h4 className="font-medium">Order Items:</h4>
              {detailedOrder?.items ? (
                <div className="space-y-2">
                  {detailedOrder.items.map((item: any, index: number) => (
                    <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                      <p><strong>{item.product_name}</strong></p>
                      <p>Quantity: {item.quantity}</p>
                      <p>Price: {formatCurrency(item.unit_price)}</p>
                      <p>Total: {formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              ) : order.order_items ? (
                <div className="space-y-2">
                  {order.order_items.map((item, index) => (
                    <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                      <p><strong>{item.product_name}</strong></p>
                      <p>Quantity: {item.quantity}</p>
                      <p>Price: {formatCurrency(item.unit_price)}</p>
                      <p>Total: {formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading product details...</p>
              )}
              
              {detailedOrder?.delivery_schedule && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">Delivery Schedule</h4>
                  <p className="text-sm text-blue-800">
                    {new Date(detailedOrder.delivery_schedule.scheduled_date).toLocaleDateString()} 
                    {detailedOrder.delivery_schedule.time_slot && ` at ${detailedOrder.delivery_schedule.time_slot}`}
                  </p>
                  {detailedOrder.delivery_schedule.notes && (
                    <p className="text-xs text-blue-700 mt-1">
                      Notes: {detailedOrder.delivery_schedule.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Created: {new Date(order.created_at).toLocaleString()}</p>
          {order.updated_at !== order.created_at && (
            <p>Updated: {new Date(order.updated_at).toLocaleString()}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminOrders;