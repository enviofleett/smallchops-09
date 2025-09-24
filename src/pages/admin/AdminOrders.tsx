import React, { useState, useMemo, useEffect } from 'react';
import '../../styles/thermal-print.css';
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
import { EnhancedOrderCard } from '@/components/admin/EnhancedOrderCard';
import { ThermalReceiptPreview } from '@/components/orders/ThermalReceiptPreview';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { MobileOrderTabs } from '@/components/admin/orders/MobileOrderTabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Filter, Download, Package, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, Activity, ChevronDown, MapPin, Truck, BarChart3, Send, RefreshCw, Calendar, MessageSquare, Printer, Loader2 } from 'lucide-react';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { supabase } from '@/integrations/supabase/client';
import { ProductDetailCard } from '@/components/orders/ProductDetailCard';
import { format } from 'date-fns';
import { PickupPointDisplay } from '@/components/admin/PickupPointDisplay';
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { useDebounce } from '@/hooks/useDebounce';
import { HourlyDeliveryFilter } from '@/components/admin/orders/HourlyDeliveryFilter';
import { DeliveryDateFilter } from '@/components/admin/orders/DeliveryDateFilter';
import { OrderTabDropdown } from '@/components/admin/orders/OrderTabDropdown';
import { addDays, format as formatDate, isSameDay, isWithinInterval, startOfDay, endOfDay, subDays, isToday, isYesterday } from 'date-fns';
import { filterOrdersByDate, getFilterDescription, getFilterStats, DeliveryFilterType } from '@/utils/dateFilterUtils';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useEnhancedOrderScheduleRecovery } from '@/hooks/useEnhancedOrderScheduleRecovery';
import { useOrderScheduleRecovery } from '@/hooks/useOrderScheduleRecovery';
import { ProductionErrorBoundary } from '@/components/admin/ProductionErrorBoundary';
import ProductionOrderErrorBoundary from '@/components/admin/ProductionOrderErrorBoundary';
import OrderErrorBoundary from '@/components/orders/OrderErrorBoundary';

function AdminOrdersContent() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [showDeliveryReport, setShowDeliveryReport] = useState(false);
  const [useSimpleMode, setUseSimpleMode] = useState(false);
  
  // Production-safe schedule recovery with circuit breaker
  const { attemptScheduleRecovery, getRecoveryStatus } = useOrderScheduleRecovery();
  
  // Hourly delivery filter state for confirmed tab
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Thermal printing functionality
  const { 
    showPreview, 
    closePreview, 
    printFromPreview, 
    isPrinting, 
    isPreviewOpen, 
    previewOrder, 
    previewDeliverySchedule, 
    previewBusinessInfo 
  } = useThermalPrint();

  // Fetch business info for receipts
  const { data: businessInfo } = useQuery({
    queryKey: ['business-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('name, admin_notification_email, whatsapp_support_number, logo_url')
        .single();
      
      if (error) {
        console.warn('Could not fetch business info:', error);
        return null;
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearchQuery, deliveryFilter, selectedDay, selectedHour]);

  // Reset hourly filters when changing tabs (except for confirmed tab)
  useEffect(() => {
    if (activeTab !== 'confirmed') {
      setSelectedDay(null);
      setSelectedHour(null);
    }
  }, [activeTab]);

  // Fetch orders with pagination and filters
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-orders', currentPage, statusFilter, debouncedSearchQuery],
    queryFn: () => getOrders({
      page: currentPage,
      pageSize: 20,
      status: statusFilter === 'all' ? undefined : statusFilter,
      searchQuery: debouncedSearchQuery || undefined
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
    placeholderData: (previousData) => previousData // Keep previous data while loading new data
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

  // Priority sort and filter orders for production
  const prioritySortedOrders = useMemo(() => {
    let ordersCopy = [...orders];
    
    // Filter and sort confirmed orders - ONLY PAID ORDERS
    if (statusFilter === 'confirmed') {
      // First filter: only paid confirmed orders
      ordersCopy = orders.filter(order => 
        order.status === 'confirmed' && order.payment_status === 'paid'
      );
      
      // Sort with today's orders first, then by delivery schedule
      ordersCopy.sort((a, b) => {
        const scheduleA = deliverySchedules[a.id];
        const scheduleB = deliverySchedules[b.id];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if orders are scheduled for today
        const aIsToday = scheduleA && new Date(scheduleA.delivery_date).setHours(0, 0, 0, 0) === today.getTime();
        const bIsToday = scheduleB && new Date(scheduleB.delivery_date).setHours(0, 0, 0, 0) === today.getTime();
        
        // Today's orders come first
        if (aIsToday && !bIsToday) return -1;
        if (!aIsToday && bIsToday) return 1;
        
        // Among today's orders, sort by time slot (earliest first)
        if (aIsToday && bIsToday) {
          // Both today - sort by time slot
          if (scheduleA && scheduleB) {
            const timeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
            const timeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
            return timeA.getTime() - timeB.getTime();
          }
        }
        
        // For non-today orders, sort by delivery date + time
        if (scheduleA && scheduleB) {
          const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
          const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
          return dateTimeA.getTime() - dateTimeB.getTime();
        }
        
        // Orders with schedules come first
        if (scheduleA && !scheduleB) return -1;
        if (!scheduleA && scheduleB) return 1;
        
        // Fallback to order time (most recent first for unscheduled orders)
        return new Date(b.order_time || b.created_at).getTime() - 
               new Date(a.order_time || a.created_at).getTime();
      });
    }
    
    return ordersCopy;
  }, [orders, deliverySchedules, statusFilter]);

  // Filter orders by delivery schedule with defensive date handling + hourly filtering

  // Production-ready filtering with performance optimizations
  const filteredOrders = useMemo(() => {
    let result = prioritySortedOrders;
    
    // Apply comprehensive delivery/pickup date filter using utility functions
    if (deliveryFilter !== 'all') {
      try {
        result = filterOrdersByDate(result, deliveryFilter, deliverySchedules);
      } catch (error) {
        console.error('Error applying date filter:', error);
        // Fallback to showing all orders if filtering fails
        result = prioritySortedOrders;
      }
    }
    
    // Apply hourly filtering for confirmed tab
    if (activeTab === 'confirmed' && (selectedDay || selectedHour)) {
      const today = startOfDay(new Date());
      const tomorrow = startOfDay(addDays(new Date(), 1));
      
      result = result.filter(order => {
        // Only filter delivery orders with paid status that have schedules
        if (order.order_type !== 'delivery' || order.payment_status !== 'paid') {
          return false;
        }
        
        const schedule = deliverySchedules[order.id];
        if (!schedule?.delivery_date) return false;
        
        try {
          const deliveryDate = new Date(schedule.delivery_date);
          
          // Validate delivery date
          if (isNaN(deliveryDate.getTime())) {
            console.warn('Invalid delivery date for order:', order.id, schedule.delivery_date);
            return false;
          }
          
          const normalizedDeliveryDate = startOfDay(deliveryDate);
          
          // Filter by selected day - must match exactly
          if (selectedDay) {
            const targetDate = selectedDay === 'today' ? today : tomorrow;
            if (normalizedDeliveryDate.getTime() !== targetDate.getTime()) {
              return false;
            }
          }
          
          // Filter by selected hour - more robust hour matching
          if (selectedHour && schedule.delivery_time_start) {
            const orderTimeComponents = schedule.delivery_time_start.split(':');
            const selectedTimeComponents = selectedHour.split(':');
            
            if (orderTimeComponents.length < 2 || selectedTimeComponents.length < 2) {
              console.warn('Invalid time format for order:', order.id, schedule.delivery_time_start);
              return false;
            }
            
            const orderHour = parseInt(orderTimeComponents[0], 10);
            const selectedHourInt = parseInt(selectedTimeComponents[0], 10);
            
            if (isNaN(orderHour) || isNaN(selectedHourInt) || orderHour !== selectedHourInt) {
              return false;
            }
          }
          
          return true;
        } catch (error) {
          console.warn('Error processing delivery schedule for order:', order.id, error);
          return false;
        }
      });
    }
    
    return result;
  }, [prioritySortedOrders, deliverySchedules, deliveryFilter, selectedDay, selectedHour]);

  // Calculate hourly order counts for confirmed orders
  const hourlyOrderCounts = useMemo(() => {
    if (activeTab !== 'confirmed') return { today: {}, tomorrow: {} };
    
    const today = startOfDay(new Date());
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const counts = {
      today: {} as Record<string, number>,
      tomorrow: {} as Record<string, number>
    };
    
    // Initialize hourly slots (8 AM to 10 PM)
    for (let hour = 8; hour <= 22; hour++) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      counts.today[timeSlot] = 0;
      counts.tomorrow[timeSlot] = 0;
    }
    
    // Count orders for each hour - only paid delivery orders with valid schedules
    prioritySortedOrders.forEach(order => {
      // Only count relevant orders in confirmed tab (not just confirmed status)
      if (order.order_type !== 'delivery' || order.payment_status !== 'paid') return;
      
      const schedule = deliverySchedules[order.id];
      if (!schedule?.delivery_date || !schedule.delivery_time_start) return;
      
      try {
        const deliveryDate = new Date(schedule.delivery_date);
        
        // Validate delivery date
        if (isNaN(deliveryDate.getTime())) {
          console.warn('Invalid delivery date for counting:', order.id, schedule.delivery_date);
          return;
        }
        
        const normalizedDeliveryDate = startOfDay(deliveryDate);
        
        // Parse hour more robustly
        const timeComponents = schedule.delivery_time_start.split(':');
        if (timeComponents.length < 2) {
          console.warn('Invalid time format for counting:', order.id, schedule.delivery_time_start);
          return;
        }
        
        const hourInt = parseInt(timeComponents[0], 10);
        if (isNaN(hourInt) || hourInt < 8 || hourInt > 22) {
          console.warn('Hour out of range for counting:', order.id, hourInt);
          return;
        }
        
        const orderHour = `${hourInt.toString().padStart(2, '0')}:00`;
        
        // Count for today and tomorrow only
        if (normalizedDeliveryDate.getTime() === today.getTime()) {
          counts.today[orderHour] = (counts.today[orderHour] || 0) + 1;
        } else if (normalizedDeliveryDate.getTime() === tomorrow.getTime()) {
          counts.tomorrow[orderHour] = (counts.tomorrow[orderHour] || 0) + 1;
        }
      } catch (error) {
        console.warn('Error processing order for hourly counts:', order.id, error);
      }
    });
    
    return counts;
  }, [prioritySortedOrders, deliverySchedules, activeTab]);

  // Calculate overdue order counts by date ranges
  // Get order counts by status for tab badges
  const orderCounts = useMemo(() => {
    return {
      all: totalCount,
      confirmed: orders.filter(o => o.status === 'confirmed' && o.payment_status === 'paid').length, // Only paid confirmed orders
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
      delivered: orders.filter(o => o.status === 'delivered').length
    };
  }, [orders, totalCount]);

  const handleOrderClick = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsDialogOpen(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // No need to manually trigger refetch - debounced query will handle it
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setStatusFilter(value as 'all' | OrderStatus);
    // currentPage reset is handled by useEffect above
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
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Monitor and manage all customer orders and deliveries
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto"
              onClick={() => setShowDeliveryReport(!showDeliveryReport)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Delivery Report
            </Button>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </div>
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
                  <p className="text-sm text-muted-foreground">Ready Orders</p>
                  <p className="text-2xl font-bold">{orderCounts.ready}</p>
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

        {/* Delivery Report Section */}
        {showDeliveryReport && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Daily Delivery Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredOrders.filter(o => o.status === 'out_for_delivery').length}
                  </p>
                  <p className="text-sm text-blue-600">Out for Delivery</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {filteredOrders.filter(o => o.status === 'delivered').length}
                  </p>
                  <p className="text-sm text-green-600">Delivered Today</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">
                    {filteredOrders.filter(o => o.status === 'ready').length}
                  </p>
                  <p className="text-sm text-gray-600">Ready for Pickup</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Upcoming deliveries:</strong> {filteredOrders.filter(o => 
                    o.status === 'confirmed' || o.status === 'preparing'
                  ).length} orders ready for dispatch
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                  <Button 
                    type="button" 
                    variant={useSimpleMode ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setUseSimpleMode(!useSimpleMode)}
                    className="flex-1 sm:flex-none"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{useSimpleMode ? 'Simple' : 'Advanced'}</span>
                  </Button>
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
              
              <DeliveryDateFilter
                value={deliveryFilter}
                onChange={setDeliveryFilter}
                orderCounts={useMemo(() => {
                  const stats = getFilterStats(prioritySortedOrders, deliverySchedules);
                  return {
                    all: stats.all,
                    today: stats.today,
                    tomorrow: stats.tomorrow,
                    future: stats.future
                  };
                }, [prioritySortedOrders, deliverySchedules])}
              />
              
              {/* Enhanced Filter Statistics - Production Ready */}
              {deliveryFilter !== 'all' && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {getFilterDescription(deliveryFilter, filteredOrders.length, prioritySortedOrders.length).split(':')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getFilterDescription(deliveryFilter, filteredOrders.length, prioritySortedOrders.length)}
                      </p>
                      {filteredOrders.length === 0 && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span>No orders found for this time period. Try selecting a different date range or check if orders have delivery schedules.</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Quick Stats for Current Filter */}
                      {filteredOrders.length > 0 && (
                        <div className="mt-2 flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Pickup: {filteredOrders.filter(o => o.order_type === 'pickup').length}
                          </span>
                          <span className="text-muted-foreground">
                            Delivery: {filteredOrders.filter(o => o.order_type === 'delivery').length}
                          </span>
                          <span className="text-muted-foreground">
                            Paid: {filteredOrders.filter(o => o.payment_status === 'paid').length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders Tabs - Fully Responsive */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="relative">
            {/* Mobile & Tablet: Dropdown */}
            <div className="block md:hidden mb-4">
              <OrderTabDropdown
                activeTab={activeTab}
                onTabChange={handleTabChange}
                orderCounts={orderCounts}
        />

        {/* Thermal Receipt Preview Modal */}
        <ThermalReceiptPreview
          isOpen={isPreviewOpen}
          onClose={closePreview}
          onPrint={printFromPreview}
          order={previewOrder}
          deliverySchedule={previewDeliverySchedule}
          businessInfo={previewBusinessInfo}
          isPrinting={isPrinting}
        />
      </div>
            
            {/* Desktop: Full grid layout */}
            <div className="hidden md:block">
              <TabsList className="grid w-full grid-cols-6 gap-1 p-1 bg-muted rounded-lg">
                <TabsTrigger value="all" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  All Orders ({orderCounts.all})
                </TabsTrigger>
                <TabsTrigger value="confirmed" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Confirmed ({orderCounts.confirmed})
                </TabsTrigger>
                <TabsTrigger value="preparing" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Preparing ({orderCounts.preparing})
                </TabsTrigger>
                <TabsTrigger value="ready" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Ready ({orderCounts.ready})
                </TabsTrigger>
                <TabsTrigger value="out_for_delivery" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Out for Delivery ({orderCounts.out_for_delivery})
                </TabsTrigger>
                <TabsTrigger value="delivered" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Delivered ({orderCounts.delivered})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Mobile and Desktop Content */}
          {isMobile ? (
            <MobileOrderTabs
              orders={filteredOrders}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onOrderSelect={handleOrderClick}
              deliverySchedules={deliverySchedules}
              orderCounts={orderCounts}
              useSimpleMode={useSimpleMode}
            />
          ) : (
            <TabsContent value={activeTab} className="space-y-4">
              {/* Hourly Delivery Filter - Only show for confirmed tab */}
              {activeTab === 'confirmed' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Delivery Time Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HourlyDeliveryFilter
                      selectedDay={selectedDay}
                      selectedHour={selectedHour}
                      onDayChange={setSelectedDay}
                      onHourChange={setSelectedHour}
                      orderCounts={hourlyOrderCounts}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Overdue Date Filter - Only show for overdue tab */}
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
                    <div key={order.id} className="flex items-center gap-2">
                      <div onClick={() => handleOrderClick(order)} className="flex-1 cursor-pointer transition-transform hover:scale-[1.01]">
                        <EnhancedOrderCard 
                          order={order} 
                          deliverySchedule={deliverySchedules[order.id]} 
                          onOrderSelect={handleOrderClick}
                          useSimpleMode={useSimpleMode}
                        />
                      </div>
                      {/* Print Receipt Button */}
                      {order.payment_status === 'paid' && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            showPreview(order, deliverySchedules[order.id], businessInfo);
                          }}
                          disabled={isPrinting}
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0"
                          title="Preview thermal receipt"
                        >
                          {isPrinting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                      )}
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
          )}
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

        {/* Thermal Receipt Preview Modal */}
        <ThermalReceiptPreview
          isOpen={isPreviewOpen}
          onClose={closePreview}
          onPrint={printFromPreview}
          order={previewOrder}
          deliverySchedule={previewDeliverySchedule}
          businessInfo={previewBusinessInfo}
          isPrinting={isPrinting}
        />
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // PRODUCTION-SAFE: Use centralized status update hook
  const { updateStatus, isUpdating } = useProductionStatusUpdate();

  // Out-for-delivery email mutation
  const sendDeliveryEmailMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('send-out-for-delivery-email', {
        body: { order_id: orderId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast({
        title: "Email Sent",
        description: "Out-for-delivery notification sent to customer.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send delivery notification.",
        variant: "destructive",
      });
    }
  });

  const handleStatusUpdate = (newStatus: OrderStatus) => {
    updateStatus({ orderId: order.id, status: newStatus });
  };

  const handleSendDeliveryEmail = () => {
    sendDeliveryEmailMutation.mutate(order.id);
  };
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
          <div className="flex items-center gap-2">
            <Badge className={getStatusBadgeColor(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {/* Status update buttons */}
            {order.status === 'confirmed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate('preparing');
                }}
                 disabled={isUpdating}
              >
                {isUpdating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Start Preparing'
                )}
              </Button>
            )}
            {order.status === 'preparing' && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusUpdate('ready');
                  }}
                   disabled={isUpdating}
                >
                  Mark Ready
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendDeliveryEmail();
                  }}
                  disabled={sendDeliveryEmailMutation.isPending}
                  title="Send out-for-delivery email"
                >
                  {sendDeliveryEmailMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
            {order.status === 'ready' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendDeliveryEmail();
                }}
                disabled={sendDeliveryEmailMutation.isPending}
              >
                {sendDeliveryEmailMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Out for Delivery
                  </>
                )}
              </Button>
            )}
            {order.status === 'out_for_delivery' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate('delivered');
                }}
                disabled={isUpdating}
              >
                Mark Delivered
              </Button>
            )}
          </div>
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
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-2">Product Details</h4>
              <p className="text-sm text-muted-foreground">Product details available in full order view</p>
            </div>
          </div>
        )}

        {/* Enhanced Delivery Information Display using DeliveryScheduleDisplay */}
        {order.payment_status === 'paid' && (
          <div className="mt-4 border-t pt-4">
            {/* Order Delivery Schedule Data */}
            <div className="flex items-center gap-2 mb-4">
              {order.order_type === 'delivery' ? (
                <Truck className="w-5 h-5 text-primary" />
              ) : (
                <Package className="w-5 h-5 text-primary" />
              )}
              <h4 className="font-semibold text-base">
                {order.order_type === 'delivery' ? 'Delivery Schedule' : 'Pickup Schedule'}
              </h4>
            </div>
            
            {order.delivery_schedule ? (
              <div className="space-y-3">
                {/* Use order's embedded delivery schedule */}
                <DeliveryScheduleDisplay 
                  schedule={order.delivery_schedule}
                  orderType={order.order_type === 'dine_in' ? 'pickup' : order.order_type}
                  orderStatus={order.status}
                  className="mb-0" 
                />
                
                {/* Schedule Request Info */}
                {(order.delivery_schedule.requested_at || order.delivery_schedule.created_at) && (
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    Scheduled on {(() => {
                      const dateToFormat = order.delivery_schedule.requested_at || order.delivery_schedule.created_at;
                      if (!dateToFormat) return 'Date unavailable';
                      try {
                        return format(new Date(dateToFormat), 'MMM d, yyyy \'at\' h:mm a');
                      } catch {
                        return 'Invalid date';
                      }
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-950 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    No {order.order_type === 'delivery' ? 'delivery' : 'pickup'} schedule found for this order.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Schedule will be confirmed after payment is verified.
                  </p>
                </div>
              </div>
            )}
            
            {/* Special Instructions Fallback */}
            {!order.delivery_schedule?.special_instructions && order.special_instructions && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg mt-4">
                <p className="text-sm font-medium text-orange-800 mb-1">Order Special Instructions:</p>
                <p className="text-sm text-orange-700 break-words">
                  {order.special_instructions}
                </p>
              </div>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    );
}

export default function AdminOrders() {
  return (
    <ProductionOrderErrorBoundary>
      <AdminOrdersContent />
    </ProductionOrderErrorBoundary>
  );
}
