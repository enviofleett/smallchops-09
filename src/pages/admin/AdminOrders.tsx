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
import { getOrdersWithDeliverySchedule } from '@/api/deliveryScheduleApi';
import { useDeliveryOrdersWithFiltering, calculateOrderMetrics } from '@/hooks/useDeliveryOrdersWithFiltering';
import { EnhancedDeliveryFilter } from '@/components/admin/delivery/EnhancedDeliveryFilter';
import { MobileDeliveryCard } from '@/components/admin/delivery/MobileDeliveryCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { OrderStatus } from '@/types/orders';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { EnhancedOrderCard } from '@/components/orders/EnhancedOrderCard';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { CountdownTimer } from '@/components/orders/CountdownTimer';
import { Search, Filter, Download, Package, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, Activity, ChevronDown, Calendar, MapPin, Truck } from 'lucide-react';
import { ProductDetailCard } from '@/components/orders/ProductDetailCard';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { format, isToday, isTomorrow, isWithinInterval, subDays, addDays } from 'date-fns';
import { PerformanceDebugger } from '@/components/monitoring/PerformanceDebugger';
export default function AdminOrders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'this_week' | 'past_week'>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [deliveryUrgency, setDeliveryUrgency] = useState<'all' | 'urgent' | 'due_today' | 'upcoming'>('all');
  const isMobile = useIsMobile();

  // Use the enhanced filtering hook
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useDeliveryOrdersWithFiltering({
    dateRange: dateFilter,
    timeSlot: timeSlotFilter,
    urgency: deliveryUrgency,
    status: statusFilter,
    searchQuery,
    page: currentPage,
    pageSize: 20
  });

  // Use calculated metrics from the API response or fallback to manual calculation
  const orderMetrics = ordersData?.metrics || (ordersData ? calculateOrderMetrics(ordersData.orders) : {
    total: 0,
    urgent: 0,
    dueToday: 0,
    upcoming: 0
  });
  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.count || 0;
  const totalPages = Math.ceil(totalCount / 20);

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

        {/* Enhanced Search and Filters */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
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
            </CardContent>
          </Card>

          {/* Enhanced Delivery Filter Component */}
          <EnhancedDeliveryFilter filters={{
          dateRange: dateFilter,
          timeSlot: timeSlotFilter,
          urgency: deliveryUrgency
        }} onFiltersChange={filters => {
          setDateFilter(filters.dateRange);
          setTimeSlotFilter(filters.timeSlot);
          setDeliveryUrgency(filters.urgency);
          setCurrentPage(1); // Reset to first page when filters change
          // Trigger refetch automatically via query invalidation
        }} onClearFilters={() => {
          setDateFilter('all');
          setTimeSlotFilter('all');
          setDeliveryUrgency('all');
          setSearchQuery('');
          setStatusFilter('all');
          setCurrentPage(1);
          // Clear all filters and reset to default view
        }} orderCounts={orderMetrics} />
        </div>

        {/* Performance Debugger */}
        {import.meta.env.DEV && <PerformanceDebugger />}

        {/* Orders Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">
              All Orders ({orderCounts.all})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({orderCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              Confirmed ({orderCounts.confirmed})
            </TabsTrigger>
            <TabsTrigger value="preparing">
              Preparing ({orderCounts.preparing})
            </TabsTrigger>
            <TabsTrigger value="out_for_delivery">
              Out for Delivery ({orderCounts.out_for_delivery})
            </TabsTrigger>
            <TabsTrigger value="delivered">
              Delivered ({orderCounts.delivered})
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
              </Card> : orders.length === 0 ? <Card className="p-6">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">No orders found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'Try adjusting your search criteria' : 'No orders match the current filter'}
                  </p>
                </div>
              </Card> : <>
                {/* Orders List - Responsive Design */}
                <div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
                  {orders.map(order => {
                const deliverySchedule = ordersData?.hasDeliverySchedule ? (order as any).delivery_schedule : null;
                const isUrgent = deliverySchedule ? (() => {
                  const now = new Date();
                  const deliveryDateTime = new Date(deliverySchedule.delivery_date);
                  const [startHours, startMinutes] = deliverySchedule.delivery_time_start.split(':').map(Number);
                  deliveryDateTime.setHours(startHours, startMinutes, 0, 0);
                  const hoursUntilDelivery = (deliveryDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                  return hoursUntilDelivery <= 2 && hoursUntilDelivery > 0;
                })() : false;
                return <div key={order.id}>
                        {isMobile ? <MobileDeliveryCard order={order} deliverySchedule={deliverySchedule} isUrgent={isUrgent} onCardClick={() => handleOrderClick(order)} /> : <div onClick={() => handleOrderClick(order)} className="cursor-pointer transition-transform hover:scale-[1.01]">
                            <AdminOrderCard order={order} />
                          </div>}
                      </div>;
              })}
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

// Enhanced Admin-specific order card component with delivery schedule
function AdminOrderCard({
  order
}: {
  order: OrderWithItems;
}) {
  const {
    data: deliverySchedule
  } = useQuery({
    queryKey: ['delivery-schedule', order.id],
    queryFn: () => getDeliveryScheduleByOrderId(order.id),
    enabled: order.order_type === 'delivery'
  });
  const {
    data: detailedOrderData,
    isLoading: isLoadingDetails
  } = useDetailedOrderData(order.id);
  const [showProductDetails, setShowProductDetails] = useState(false);

  // Determine if delivery is urgent (within next 2 hours) - with error handling
  const isUrgentDelivery = deliverySchedule ? (() => {
    try {
      const now = new Date();
      const deliveryDateTime = new Date(deliverySchedule.delivery_date);
      const [startHours, startMinutes] = deliverySchedule.delivery_time_start.split(':').map(Number);
      deliveryDateTime.setHours(startHours, startMinutes, 0, 0);
      const hoursUntilDelivery = (deliveryDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilDelivery <= 2 && hoursUntilDelivery > 0;
    } catch (error) {
      console.error('Error calculating delivery urgency:', error);
      return false;
    }
  })() : false;
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
  return <Card className={`hover:shadow-md transition-shadow ${isUrgentDelivery ? 'ring-2 ring-orange-200 bg-orange-50/30' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
                {isUrgentDelivery && <Badge variant="destructive" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    URGENT
                  </Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(order.order_time), 'PPp')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.order_type === 'delivery' ? <Truck className="w-4 h-4 text-blue-600" /> : <MapPin className="w-4 h-4 text-green-600" />}
            <Badge className={getStatusBadgeColor(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Enhanced Delivery Schedule Display */}
        {order.order_type === 'delivery' && <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Delivery Schedule
            </div>
            
            {deliverySchedule ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Delivery Details */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {format(new Date(deliverySchedule.delivery_date), 'EEEE, MMMM d, yyyy')}
                    </p>
                     <p className="text-sm text-muted-foreground">
                       {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                     </p>
                     {deliverySchedule.is_flexible && <Badge variant="outline" className="text-xs">
                         Flexible Time
                       </Badge>}
                     {deliverySchedule.special_instructions && <p className="text-xs text-muted-foreground mt-2">
                         Note: {deliverySchedule.special_instructions}
                       </p>}
                   </div>
                 </div>

                 {/* Countdown Timer */}
                 <div className="p-3 bg-primary/5 rounded-lg">
                   <CountdownTimer deliveryDate={deliverySchedule.delivery_date} deliveryTimeStart={deliverySchedule.delivery_time_start} deliveryTimeEnd={deliverySchedule.delivery_time_end} isFlexible={deliverySchedule.is_flexible} className="text-sm" />
                 </div>
               </div> : <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                 <div className="flex items-center gap-2 text-orange-800">
                   <Clock className="w-4 h-4" />
                   <p className="text-sm font-medium">Schedule Pending</p>
                 </div>
                 <p className="text-xs text-orange-700 mt-1">
                   Delivery schedule will be assigned soon
                 </p>
               </div>}
           </div>}

        {/* Pickup Information */}
        {order.order_type === 'pickup' && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Store Pickup</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Ready for pickup at store location
            </p>
          </div>}
      </CardContent>
    </Card>;
}