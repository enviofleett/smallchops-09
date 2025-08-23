import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  DollarSign
} from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { OrderWithItems } from '@/api/orders';

interface DeliveryDashboardProps {
  className?: string;
}

export function DeliveryDashboard({ className }: DeliveryDashboardProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Format date for API
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  // Fetch orders for selected date
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['delivery-orders', formattedDate],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 50,
      startDate: formattedDate,
      endDate: formattedDate,
    }),
    refetchInterval: 30000,
  });

  // Filter delivery orders and get order IDs
  const deliveryOrders = useMemo(() => 
    ordersData?.orders?.filter(order => 
      order.order_type === 'delivery' && 
      ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)
    ) || [],
    [ordersData]
  );

  const orderIds = useMemo(() => 
    deliveryOrders.map(order => order.id),
    [deliveryOrders]
  );

  // Fetch delivery schedules
  const { schedules } = useOrderDeliverySchedules(orderIds);

  // Calculate metrics
  const metrics = useMemo(() => {
    const ready = deliveryOrders.filter(order => order.status === 'ready').length;
    const outForDelivery = deliveryOrders.filter(order => order.status === 'out_for_delivery').length;
    const totalValue = deliveryOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    return {
      totalOrders: deliveryOrders.length,
      readyOrders: ready,
      outForDelivery,
      totalValue
    };
  }, [deliveryOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800 border-purple-200';
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
      {/* Header with Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Delivery Dashboard</h2>
          <p className="text-muted-foreground">
            {isToday(selectedDate) ? "Today's orders" : `Orders for ${format(selectedDate, 'PPP')}`}
          </p>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, 'PPP')}
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">delivery orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.readyOrders}</div>
            <p className="text-xs text-muted-foreground">ready for pickup</p>
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
          <CardTitle>Delivery Orders</CardTitle>
          <p className="text-sm text-muted-foreground">
            {deliveryOrders.length} orders scheduled for delivery
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : deliveryOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No delivery orders for {format(selectedDate, 'PPP')}
            </div>
          ) : (
            <div className="divide-y">
              {deliveryOrders.map((order) => {
                const schedule = order.delivery_schedule || schedules[order.id];
                const isExpanded = expandedOrder === order.id;
                
                return (
                  <div key={order.id} className="p-4 sm:p-6">
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{order.order_number}</h3>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getStatusColor(order.status))}
                          >
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
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

                    {/* Quick Info - Mobile */}
                    <div className="flex justify-between items-center mb-3 sm:hidden">
                      <div className="font-semibold">₦{order.total_amount?.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {getPaymentMethodDisplay(order.payment_method || 'online')}
                      </div>
                    </div>

                    {/* Delivery Schedule */}
                    {schedule && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {format(parseISO(schedule.delivery_date), 'PPP')} • 
                          {schedule.delivery_time_start}-{schedule.delivery_time_end}
                        </span>
                      </div>
                    )}

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
                              {order.delivery_address ? (
                                typeof order.delivery_address === 'string' 
                                  ? order.delivery_address 
                                  : JSON.stringify(order.delivery_address)
                              ) : (
                                'No address provided'
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Order Items</h4>
                          <div className="space-y-2">
                            {order.order_items?.map((item, index) => (
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