import React, { useState, useMemo } from 'react';
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
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';

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

  // Extract delivery schedules from orders (now included in admin function)
  const deliverySchedules = useMemo(() => {
    const scheduleMap: Record<string, any> = {};
    orders.forEach((order: any) => {
      if (order.delivery_schedule) {
        scheduleMap[order.id] = order.delivery_schedule;
      }
    });
    return scheduleMap;
  }, [orders]);

  // Priority sort confirmed orders by delivery/pickup schedule
  const prioritySortedOrders = useMemo(() => {
    const ordersCopy = [...orders];
    
    if (statusFilter === 'confirmed') {
      return ordersCopy.sort((a, b) => {
        const scheduleA = deliverySchedules[a.id];
        const scheduleB = deliverySchedules[b.id];
        
        // If both have schedules, sort by delivery date + time
        if (scheduleA && scheduleB) {
          const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
          const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
          return dateTimeA.getTime() - dateTimeB.getTime();
        }
        
        // Orders with schedules come first
        if (scheduleA && !scheduleB) return -1;
        if (!scheduleA && scheduleB) return 1;
        
        // Fallback to order time
        return new Date(a.order_time || a.created_at).getTime() - 
               new Date(b.order_time || b.created_at).getTime();
      });
    }
    
    return ordersCopy;
  }, [orders, deliverySchedules, statusFilter]);

  // Filter orders by delivery schedule
  const filteredOrders = useMemo(() => {
    if (deliveryFilter === 'all') return prioritySortedOrders;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return prioritySortedOrders.filter(order => {
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
  }, [prioritySortedOrders, deliverySchedules, deliveryFilter]);

  // Get order counts by status for tab badges
  const orderCounts = useMemo(() => ({
    all: totalCount,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length
  }), [orders, totalCount]);

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

  return (
    <>
      <Helmet>
        <title>Order Management - Admin Dashboard</title>
        <meta name="description" content="Manage all orders, track deliveries, and monitor order status in real-time." />
      </Helmet>

      <div className="space-y-6">
        {/* System Status Check */}
        <SystemStatusChecker />
        
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Monitor and manage all customer orders and deliveries
            </p>
          </div>
          <Button className="w-full sm:w-auto">
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

        {/* Filters - Mobile Responsive */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex-1">
                  <Input 
                    type="text" 
                    placeholder="Search by order number, customer name, or email..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="w-full" 
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="outline" className="flex-1 sm:flex-none">
                    <Search className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Search</span>
                  </Button>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
              </form>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Delivery Schedule:</span>
                </div>
                <Select value={deliveryFilter} onValueChange={(value: 'all' | 'due_today' | 'upcoming') => setDeliveryFilter(value)}>
                  <SelectTrigger className="w-full sm:w-48">
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
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card className="p-6">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                  <p className="text-red-600 font-medium">Error loading orders</p>
                  <p className="text-sm text-muted-foreground">Please try again later</p>
                </div>
              </Card>
            ) : filteredOrders.length === 0 ? (
              <Card className="p-6">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">No orders found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || deliveryFilter !== 'all' ? 'Try adjusting your search criteria or filters' : 'No orders match the current filter'}
                  </p>
                </div>
              </Card>
            ) : (
              <>
                {/* Orders List */}
                <div className="space-y-4">
                  {filteredOrders.map(order => (
                    <div key={order.id} onClick={() => handleOrderClick(order)} className="cursor-pointer transition-transform hover:scale-[1.01]">
                      <AdminOrderCard order={order} deliverySchedule={deliverySchedules[order.id]} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * 20 + 1} to{' '}
                      {Math.min(currentPage * 20, totalCount)} of {totalCount} orders
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Order Details Dialog */}
        {selectedOrder && (
          <OrderDetailsDialog 
            order={selectedOrder} 
            isOpen={isDialogOpen} 
            onClose={() => {
              setIsDialogOpen(false);
              setSelectedOrder(null);
              refetch(); // Refresh orders after dialog closes
            }} 
          />
        )}
      </div>
    </>
  );
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

  return (
    <Card className="hover:shadow-md transition-shadow">
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
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={e => {
                  e.stopPropagation();
                  setShowProductDetails(!showProductDetails);
                }} 
                className="h-6 px-2 text-xs"
              >
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
        {showProductDetails && (
          <div className="mt-4 border-t pt-4">
            {isLoadingDetails ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              </div>
            ) : detailedOrderData?.items ? (
              <div className="space-y-2">
                <h4 className="font-medium text-sm mb-2">Product Details</h4>
                {detailedOrderData.items.map((item: any) => (
                  <ProductDetailCard key={item.id} item={item} showReorderButton={false} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Product details not available</p>
            )}
          </div>
        )}

        {/* Enhanced Delivery Information Display using DeliveryScheduleDisplay */}
        {order.payment_status === 'paid' && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              {order.order_type === 'delivery' ? (
                <Truck className="w-4 h-4 text-primary" />
              ) : (
                <Package className="w-4 h-4 text-primary" />
              )}
              <h4 className="font-medium">
                {order.order_type === 'delivery' ? 'Delivery Information' : 'Pickup Information'}
              </h4>
            </div>
            
            <div className="space-y-4">
              {/* Delivery Address */}
              {order.order_type === 'delivery' && order.delivery_address && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Delivery Address</p>
                  <p className="text-sm font-semibold">
                    {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                      ? `${(order.delivery_address as any).street || ''} ${(order.delivery_address as any).city || ''} ${(order.delivery_address as any).state || ''}`.trim()
                      : typeof order.delivery_address === 'string' 
                        ? order.delivery_address
                        : 'Address details available'
                    }
                  </p>
                </div>
              )}
              
              {/* Pickup Point */}
              {order.order_type === 'pickup' && order.pickup_point_id && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Pickup Point</p>
                  <PickupPointDisplay 
                    pickupPointId={order.pickup_point_id} 
                    pickupSchedule={
                      order.delivery_schedule ? {
                        pickup_date: order.delivery_schedule.delivery_date,
                        pickup_time_start: order.delivery_schedule.delivery_time_start,
                        pickup_time_end: order.delivery_schedule.delivery_time_end
                      } : undefined
                    }
                  />
                </div>
              )}
              
              {/* Delivery Zone */}
              {order.order_type === 'delivery' && deliveryZone && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Delivery Zone</p>
                  <p className="text-sm font-semibold">{deliveryZone.name}</p>
                  {order.delivery_fee && Number(order.delivery_fee) > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      Delivery Fee: {formatCurrency(Number(order.delivery_fee))}
                    </p>
                  )}
                </div>
              )}
              
              {/* Delivery Schedule Display or Fallback */}
              {deliverySchedule ? (
                <div className="space-y-3">
                  <DeliveryScheduleDisplay 
                    schedule={deliverySchedule}
                    orderType={order.order_type === 'dine_in' ? 'pickup' : order.order_type}
                    orderStatus={order.status}
                    className="mt-3"
                  />
                  {/* Countdown Timer for Confirmed Orders */}
                  {order.status === 'confirmed' && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <MiniCountdownTimer
                        deliveryDate={deliverySchedule.delivery_date}
                        deliveryTimeStart={deliverySchedule.delivery_time_start}
                        deliveryTimeEnd={deliverySchedule.delivery_time_end}
                        orderStatus={order.status}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mt-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-amber-800">Schedule not yet set</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Customer will receive confirmation once {order.order_type === 'delivery' ? 'delivery' : 'pickup'} is scheduled
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Instructions Fallback */}
              {!deliverySchedule?.special_instructions && order.special_instructions && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                  <p className="text-sm font-medium text-orange-800 mb-1">Order Special Instructions:</p>
                  <p className="text-sm text-orange-700 break-words">
                    {order.special_instructions}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
