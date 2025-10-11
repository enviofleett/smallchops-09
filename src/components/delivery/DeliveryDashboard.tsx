import React, { useState, useMemo } from "react";
import { formatAddress } from '@/utils/formatAddress';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  Package, 
  Clock, 
  MapPin, 
  CreditCard,
  Truck,
  ChevronDown,
  Phone,
  Mail,
  DollarSign,
  Search,
  Filter
} from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { OrderWithItems } from '@/api/orders';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';

interface DeliveryDashboardProps {
  className?: string;
}

export function DeliveryDashboard({ className }: DeliveryDashboardProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Format date for API
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  // Fetch orders for selected date
  const { data: ordersData, isLoading, error } = useQuery({
    queryKey: ['delivery-orders', formattedDate],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 100,
      startDate: formattedDate,
      endDate: formattedDate,
    }),
    refetchInterval: 30000,
    retry: 2,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Filter orders based on dropdown selections
  const filteredOrders = useMemo(() => {
    if (!ordersData?.orders) return [];
    
    let filtered = ordersData.orders.filter(order => {
      // Only show paid/completed orders with relevant delivery statuses
      const isPaid = ['paid', 'completed'].includes(order.payment_status);
      const hasRelevantStatus = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status);
      return isPaid && hasRelevantStatus;
    });

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply order type filter  
    if (orderTypeFilter !== 'all') {
      filtered = filtered.filter(order => order.order_type === orderTypeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.order_number?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_email?.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [ordersData?.orders, statusFilter, orderTypeFilter, searchQuery]);

  const orderIds = useMemo(() => 
    filteredOrders.map(order => order.id),
    [filteredOrders]
  );

  // Fetch delivery schedules
  const { schedules } = useOrderDeliverySchedules(orderIds);

  // Priority sort orders by delivery schedule for confirmed orders
  const deliveryOrders = useMemo(() => {
    return filteredOrders.sort((a, b) => {
      // Priority sort for confirmed orders by delivery schedule
      if (a.status === 'confirmed' && b.status === 'confirmed') {
        const scheduleA = schedules[a.id];
        const scheduleB = schedules[b.id];
        
        if (scheduleA && scheduleB) {
          const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
          const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
          return dateTimeA.getTime() - dateTimeB.getTime();
        }
        
        if (scheduleA && !scheduleB) return -1;
        if (!scheduleA && scheduleB) return 1;
      }
      
      // Fallback to order time
      return new Date(a.order_time || a.created_at).getTime() - 
             new Date(b.order_time || b.created_at).getTime();
    });
  }, [filteredOrders, schedules]);

  // Calculate metrics (removed ready orders)
  const metrics = useMemo(() => {
    const outForDelivery = deliveryOrders.filter(order => order.status === 'out_for_delivery').length;
    const totalValue = deliveryOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    return {
      totalOrders: deliveryOrders.length,
      preparingOrders: deliveryOrders.filter(order => order.status === 'preparing').length,
      outForDelivery,
      totalValue
    };
  }, [deliveryOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentMethodDisplay = (method: string) => {
    switch (method) {
      case 'online': return 'Online Payment';
      case 'card': return 'Card Payment';
      case 'bank_transfer': return 'Bank Transfer';
      case 'cash': return 'Cash on Delivery';
      default: return method;
    }
  };

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Date Picker and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">All Orders</h2>
          <p className="text-muted-foreground">
            {isToday(selectedDate) ? "Today's orders" : `Orders for ${format(selectedDate, 'PPP')}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'MMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>

          {/* Order Type Filter */}
          <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search orders, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Metrics Cards - Updated to remove ready orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">orders today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.preparingOrders}</div>
            <p className="text-xs text-muted-foreground">being prepared</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out for Delivery</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.outForDelivery}</div>
            <p className="text-xs text-muted-foreground">in transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{metrics.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">order value</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <p className="text-sm text-muted-foreground">
            {deliveryOrders.length} orders {statusFilter !== 'all' ? `with status: ${statusFilter}` : 'found'}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading delivery orders...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <p className="text-sm text-destructive">Failed to load orders</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : deliveryOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Package className="h-12 w-12 mx-auto opacity-50" />
              <p className="font-medium">No delivery orders</p>
              <p className="text-sm">No orders scheduled for delivery on {format(selectedDate, 'PPP')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {deliveryOrders.map((order: OrderWithItems) => {
                const schedule = (order as any).delivery_schedule || schedules[order.id];
                const isExpanded = expandedOrder === order.id;
                
                return (
                  <div key={order.id} className="p-4 sm:p-6">
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-lg">{order.order_number}</h3>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs whitespace-nowrap", getStatusColor(order.status))}
                          >
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{order.customer_name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            {order.customer_email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span className="hidden sm:inline">{order.customer_email}</span>
                                <span className="sm:hidden">{order.customer_email.substring(0, 20)}...</span>
                              </div>
                            )}
                            {order.customer_phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{order.customer_phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-semibold">₦{order.total_amount?.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">
                            {getPaymentMethodDisplay(order.payment_method || 'online')}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleOrderDetails(order.id)}
                          className="ml-2"
                        >
                          <ChevronDown className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-180"
                          )} />
                        </Button>
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="mb-4 space-y-3">
                      {/* Items Summary */}
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">Order Items ({(order as any).order_items?.length || 0})</h4>
                            <div className="text-sm text-muted-foreground">
                              Total: ₦{order.total_amount?.toLocaleString()}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {(order as any).order_items?.slice(0, 3).map((item: any, index: number) => (
                              <div key={index} className="flex justify-between items-center text-sm">
                                <span className="truncate">{item.product_name} × {item.quantity}</span>
                                <span className="font-medium whitespace-nowrap ml-2">₦{item.total_price?.toLocaleString()}</span>
                              </div>
                            ))}
                            {((order as any).order_items?.length || 0) > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{((order as any).order_items?.length || 0) - 3} more items
                              </div>
                            )}
                          </div>
                        </div>

                      {/* Payment & Delivery Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>₦{((order.total_amount || 0) - (order.delivery_fee || 0)).toLocaleString()}</span>
                          </div>
                          {order.delivery_fee && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Delivery Fee:</span>
                              <span>₦{order.delivery_fee.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-3 w-3" />
                            <span className="text-muted-foreground">Payment:</span>
                            <span className="capitalize">{order.payment_status}</span>
                          </div>
                          {schedule && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-blue-600">
                                <MapPin className="h-3 w-3" />
                                <span className="text-xs">
                                  {format(parseISO(schedule.delivery_date), 'MMM dd')} • {schedule.delivery_time_start}-{schedule.delivery_time_end}
                                </span>
                              </div>
                              {/* Countdown Timer for Confirmed Orders */}
                              {order.status === 'confirmed' && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <MiniCountdownTimer
                                    deliveryDate={schedule.delivery_date}
                                    deliveryTimeStart={schedule.delivery_time_start}
                                    deliveryTimeEnd={schedule.delivery_time_end}
                                    orderStatus={order.status}
                                    className="text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 space-y-4 bg-muted/30 p-4 rounded-lg">
                        {/* Customer Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Customer Details</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                {order.customer_email}
                              </div>
                              {order.customer_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  {order.customer_phone}
                                </div>
                              )}
                            </div>
                          </div>

                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Delivery Address</h4>
                              <div className="text-sm text-muted-foreground">
                                {formatAddress(order.delivery_address) || 'No address provided'}
                              </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Order Items</h4>
                          <div className="space-y-2">
                            {(order as any).order_items?.map((item: any, index: number) => (
                              <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{item.product_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Qty: {item.quantity} × ₦{item.unit_price?.toLocaleString()}
                                  </div>
                                </div>
                                <div className="font-medium text-sm">
                                  ₦{item.total_price?.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Payment Summary</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span>₦{((order.total_amount || 0) - (order.delivery_fee || 0)).toLocaleString()}</span>
                            </div>
                            {order.delivery_fee && (
                              <div className="flex justify-between">
                                <span>Delivery Fee</span>
                                <span>₦{order.delivery_fee.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium border-t pt-1">
                              <span>Total</span>
                              <span>₦{order.total_amount?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <CreditCard className="h-3 w-3" />
                              <span className="text-xs">
                                {getPaymentMethodDisplay(order.payment_method || 'online')} • 
                                <span className="ml-1 capitalize">{order.payment_status}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Special Instructions */}
                        {schedule?.special_instructions && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Special Instructions</h4>
                            <p className="text-sm text-muted-foreground bg-background p-2 rounded border">
                              {schedule.special_instructions}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}