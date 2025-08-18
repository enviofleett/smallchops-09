import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { EnhancedOrderCard } from '@/components/orders/EnhancedOrderCard';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { Search, Filter, Download, Package, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, Activity, ChevronDown, MapPin, Truck } from 'lucide-react';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { supabase } from '@/integrations/supabase/client';
import { ProductDetailCard } from '@/components/orders/ProductDetailCard';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { format } from 'date-fns';
import { SystemStatusChecker } from '@/components/admin/SystemStatusChecker';
import { PickupPointDisplay } from '@/components/admin/PickupPointDisplay';

export default function AdminOrders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'due_today' | 'upcoming'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch orders with pagination and filters
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-orders', currentPage, statusFilter, searchQuery],
    queryFn: () => getOrders({
      page: currentPage,
      pageSize: 20,
      status: statusFilter === 'all' ? undefined : statusFilter,
      searchQuery: searchQuery || undefined
    }),
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.count || 0;
  const totalPages = Math.ceil(totalCount / 20);

  // Fetch delivery schedules for all orders
  const orderIds = orders.map(order => order.id);
  const { schedules: deliverySchedules } = useOrderDeliverySchedules(orderIds);

  // Filter orders by delivery schedule
  const filteredOrders = React.useMemo(() => {
    if (deliveryFilter === 'all') return orders;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return orders.filter(order => {
      // Only apply delivery filter to paid delivery orders
      if (order.order_type !== 'delivery' || order.payment_status !== 'paid') {
        return true; // Show non-delivery or unpaid orders when filtering for all
      }
      
      const schedule = deliverySchedules[order.id];
      if (!schedule) return false;
      
      const deliveryDate = new Date(schedule.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      
      if (deliveryFilter === 'due_today') {
        return deliveryDate.getTime() === today.getTime();
      } else if (deliveryFilter === 'upcoming') {
        return deliveryDate.getTime() > today.getTime();
      }
      
      return false;
    });
  }, [orders, deliverySchedules, deliveryFilter]);

  // Get order counts by status for tab badges
  const orderCounts = {
    all: totalCount,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length
  };
  const handleOrderClick = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsDialogOpen(true);
  };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    refetch();
  };
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setStatusFilter(value as 'all' | OrderStatus);
    setCurrentPage(1);
  };
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  return <>
      <Helmet>
        <title>Order Management - Admin Dashboard</title>
        <meta name="description" content="Manage all orders, track deliveries, and monitor order status in real-time." />
      </Helmet>

      <div className="space-y-6">
        {/* System Status Check */}
        <SystemStatusChecker />
        {/* Performance Monitor */}
        
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">
              Monitor and manage all customer orders and deliveries
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Order
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-2xl font-bold">{orderCounts.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">
                    {orderCounts.preparing + orderCounts.out_for_delivery}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold">{orderCounts.delivered}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{orderCounts.all}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1">
                  <Input type="text" placeholder="Search by order number, customer name, or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full" />
                </div>
                <Button type="submit" variant="outline">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </form>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Delivery Schedule:</span>
                </div>
                <Select value={deliveryFilter} onValueChange={(value: 'all' | 'due_today' | 'upcoming') => setDeliveryFilter(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="due_today">Due Today</SelectItem>
                    <SelectItem value="upcoming">Upcoming Deliveries</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">All Orders</span>
              <span className="sm:hidden">All</span>
              <span className="ml-1">({orderCounts.all})</span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Pending</span>
              <span className="sm:hidden">Pend</span>
              <span className="ml-1">({orderCounts.pending})</span>
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Confirmed</span>
              <span className="sm:hidden">Conf</span>
              <span className="ml-1">({orderCounts.confirmed})</span>
            </TabsTrigger>
            <TabsTrigger value="preparing" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Preparing</span>
              <span className="sm:hidden">Prep</span>
              <span className="ml-1">({orderCounts.preparing})</span>
            </TabsTrigger>
            <TabsTrigger value="out_for_delivery" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Out for Delivery</span>
              <span className="sm:hidden">Out</span>
              <span className="ml-1">({orderCounts.out_for_delivery})</span>
            </TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Delivered</span>
              <span className="sm:hidden">Del</span>
              <span className="ml-1">({orderCounts.delivered})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {isLoading ? <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Card key={i} className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                    </div>
                  </Card>)}
              </div> : error ? <Card className="p-6">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                  <p className="text-red-600 font-medium">Error loading orders</p>
                  <p className="text-sm text-muted-foreground">Please try again later</p>
                </div>
              </Card> : filteredOrders.length === 0 ? <Card className="p-6">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">No orders found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || deliveryFilter !== 'all' ? 'Try adjusting your search criteria or filters' : 'No orders match the current filter'}
                  </p>
                </div>
              </Card> : <>
                {/* Orders List */}
                <div className="space-y-4">
                  {filteredOrders.map(order => <div key={order.id} onClick={() => handleOrderClick(order)} className="cursor-pointer transition-transform hover:scale-[1.01]">
                      <AdminOrderCard order={order} deliverySchedule={deliverySchedules[order.id]} />
                    </div>)}
                </div>

                {/* Pagination */}
                {totalPages > 1 && <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * 20 + 1} to{' '}
                      {Math.min(currentPage * 20, totalCount)} of {totalCount} orders
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        Previous
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        Next
                      </Button>
                    </div>
                  </div>}
              </>}
          </TabsContent>
        </Tabs>

        {/* Order Details Dialog */}
        {selectedOrder && <OrderDetailsDialog order={selectedOrder} isOpen={isDialogOpen} onClose={() => {
        setIsDialogOpen(false);
        setSelectedOrder(null);
        refetch(); // Refresh orders after dialog closes
      }} />}
      </div>
    </>;
}

// Admin-specific order card component
function AdminOrderCard({
  order,
  deliverySchedule
}: {
  order: OrderWithItems;
  deliverySchedule?: any;
}) {
  // Fetch delivery zone information if we have a delivery address
  const { data: deliveryZone } = useQuery({
    queryKey: ['delivery-zone', order.delivery_zone_id],
    queryFn: async () => {
      if (!order.delivery_zone_id) return null;
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('name')
        .eq('id', order.delivery_zone_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order.delivery_zone_id
  });
  const {
    data: detailedOrderData,
    isLoading: isLoadingDetails
  } = useDetailedOrderData(order.id);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  return <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.order_time), 'PPp')}
            </p>
          </div>
          <Badge className={getStatusBadgeColor(order.status)}>
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{order.customer_name || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">{order.customer_email}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">Order Type & Amount</p>
            <p className="font-medium capitalize">{order.order_type}</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(order.total_amount)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">Items & Payment</p>
            <div className="flex items-center gap-2">
              <span className="font-medium">{order.order_items?.length || 0} items</span>
              <Button variant="ghost" size="sm" onClick={e => {
              e.stopPropagation();
              setShowProductDetails(!showProductDetails);
            }} className="h-6 px-2 text-xs">
                <ChevronDown className={`w-3 h-3 transition-transform ${showProductDetails ? 'rotate-180' : ''}`} />
                Products
              </Button>
            </div>
            <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
              {order.payment_status}
            </Badge>
          </div>
        </div>

        {/* Product Details Expansion */}
        {showProductDetails && <div className="mt-4 border-t pt-4">
            {isLoadingDetails ? <div className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              </div> : detailedOrderData?.items ? <div className="space-y-2">
                <h4 className="font-medium text-sm mb-2">Product Details</h4>
                {detailedOrderData.items.map((item: any) => <ProductDetailCard key={item.id} item={item} showReorderButton={false} />)}
              </div> : <p className="text-sm text-muted-foreground">Product details not available</p>}
          </div>}

        {/* Fulfillment Information for paid orders */}
        {order.payment_status === 'paid' && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center gap-2 mb-2">
              {order.order_type === 'delivery' ? (
                <Truck className="w-4 h-4 text-primary" />
              ) : (
                <Package className="w-4 h-4 text-primary" />
              )}
              <h4 className="font-medium text-sm">
                {order.order_type === 'delivery' ? 'Delivery Information' : 'Pickup Information'}
              </h4>
            </div>
            
            {/* Delivery Address - for delivery orders */}
            {order.order_type === 'delivery' && order.delivery_address && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery Address</p>
                <p className="text-sm">
                  {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                    ? `${(order.delivery_address as any).street || ''} ${(order.delivery_address as any).city || ''} ${(order.delivery_address as any).state || ''}`.trim()
                    : typeof order.delivery_address === 'string' 
                      ? order.delivery_address
                      : 'Address details available'
                  }
                </p>
              </div>
            )}
            
            {/* Pickup Point - for pickup orders */}
            {order.order_type === 'pickup' && order.pickup_point_id && (
              <PickupPointDisplay pickupPointId={order.pickup_point_id} />
            )}
            
            {/* Delivery Zone - for delivery orders */}
            {order.order_type === 'delivery' && deliveryZone && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery Zone</p>
                <p className="text-sm font-medium">{deliveryZone.name}</p>
              </div>
            )}
            
            {/* Schedule Information */}
            {deliverySchedule ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {order.order_type === 'delivery' ? 'Scheduled Delivery' : 'Scheduled Pickup'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-primary">
                      {format(new Date(deliverySchedule.delivery_date), 'EEEE, MMMM d, yyyy')}
                    </span>
                    <span className="text-muted-foreground bg-muted px-2 py-1 rounded text-xs">
                      {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                    </span>
                    {deliverySchedule.is_flexible && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                        Flexible Time
                      </Badge>
                    )}
                  </div>
                  {deliverySchedule.special_instructions && (
                    <div className="text-xs p-2 bg-amber-50 border border-amber-200 rounded">
                      <strong className="text-amber-800">Special Instructions:</strong>
                      <p className="text-amber-700 mt-1">{deliverySchedule.special_instructions}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Requested: {format(new Date(deliverySchedule.requested_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {order.order_type === 'delivery' ? 'Delivery Schedule' : 'Pickup Schedule'}
                </p>
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠️ Schedule not yet set - Customer will receive confirmation once scheduled
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>;
}