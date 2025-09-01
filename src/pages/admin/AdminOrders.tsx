import React, { useState, useMemo, useEffect } from 'react';
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
import { MobileOrderTabs } from '@/components/admin/orders/MobileOrderTabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Filter, Download, Package, TrendingUp, Clock, CheckCircle, AlertCircle, Plus, Activity, ChevronDown, MapPin, Truck, BarChart3, Send, RefreshCw } from 'lucide-react';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { supabase } from '@/integrations/supabase/client';
import { ProductDetailCard } from '@/components/orders/ProductDetailCard';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { format } from 'date-fns';
import { SystemStatusChecker } from '@/components/admin/SystemStatusChecker';
import { PickupPointDisplay } from '@/components/admin/PickupPointDisplay';
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { isOrderOverdue } from '@/utils/scheduleTime';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { HourlyDeliveryFilter } from '@/components/admin/orders/HourlyDeliveryFilter';
import { OverdueDateFilter } from '@/components/admin/orders/OverdueDateFilter';
import { addDays, format as formatDate, isSameDay, isWithinInterval, startOfDay, endOfDay, subDays, isToday, isYesterday } from 'date-fns';

export default function AdminOrders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus | 'overdue'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'due_today' | 'upcoming'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [showDeliveryReport, setShowDeliveryReport] = useState(false);
  
  // Hourly delivery filter state for confirmed tab
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  
  // Overdue date filter state for overdue tab
  const [selectedOverdueDateFilter, setSelectedOverdueDateFilter] = useState<string | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearchQuery, deliveryFilter, selectedDay, selectedHour, selectedOverdueDateFilter]);

  // Reset hourly filters when changing tabs (except for confirmed tab)
  useEffect(() => {
    if (activeTab !== 'confirmed') {
      setSelectedDay(null);
      setSelectedHour(null);
    }
    // Reset overdue filters when changing tabs (except for overdue tab)
    if (activeTab !== 'overdue') {
      setSelectedOverdueDateFilter(null);
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
      status: statusFilter === 'all' || statusFilter === 'overdue' ? undefined : statusFilter,
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

  // Priority sort and filter orders
  const prioritySortedOrders = useMemo(() => {
    let ordersCopy = [...orders];
    
    // Filter for overdue orders
    if (statusFilter === 'overdue') {
      ordersCopy = orders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule) return false;
        
        // Only show paid orders that are overdue and haven't been delivered
        return order.payment_status === 'paid' && 
               isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && 
               ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
      });
      
      // Sort overdue orders by how long they've been overdue (most critical first)
      ordersCopy.sort((a, b) => {
        const scheduleA = deliverySchedules[a.id];
        const scheduleB = deliverySchedules[b.id];
        
        if (!scheduleA || !scheduleB) return 0;
        
        const deadlineA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_end}`);
        const deadlineB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_end}`);
        
        // Most overdue orders come first (earlier deadlines first)
        return deadlineA.getTime() - deadlineB.getTime();
      });
    }
    
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
        
        // Among today's orders, overdue ones get highest priority
        if (aIsToday && bIsToday) {
          const aOverdue = scheduleA && isOrderOverdue(scheduleA.delivery_date, scheduleA.delivery_time_end);
          const bOverdue = scheduleB && isOrderOverdue(scheduleB.delivery_date, scheduleB.delivery_time_end);
          
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          
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
  const filteredOrders = useMemo(() => {
    let result = prioritySortedOrders;
    
    // Apply delivery filter first (existing logic)
    if (deliveryFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      result = prioritySortedOrders.filter(order => {
        // Only apply delivery schedule filter to paid delivery orders
        if (order.order_type !== 'delivery' || order.payment_status !== 'paid') {
          return false; // Exclude non-delivery/unpaid orders when applying delivery filters
        }
        
        const schedule = deliverySchedules[order.id];
        if (!schedule || !schedule.delivery_date) return false;
        
        try {
          const deliveryDate = new Date(schedule.delivery_date);
          if (isNaN(deliveryDate.getTime())) return false;
          
          deliveryDate.setHours(0, 0, 0, 0);
          
          if (deliveryFilter === 'due_today') {
            return deliveryDate.getTime() === today.getTime();
          } else if (deliveryFilter === 'upcoming') {
            return deliveryDate.getTime() > today.getTime();
          }
        } catch (error) {
          console.warn('Error parsing delivery date:', schedule.delivery_date, error);
          return false;
        }
        
        return false;
      });
    }
    
    // Apply hourly filtering for confirmed tab
    if (statusFilter === 'confirmed' && (selectedDay || selectedHour)) {
      const today = startOfDay(new Date());
      const tomorrow = startOfDay(addDays(new Date(), 1));
      
      result = result.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule || !schedule.delivery_date) return false;
        
        try {
          const deliveryDate = startOfDay(new Date(schedule.delivery_date));
          
          // Filter by selected day
          if (selectedDay) {
            const targetDate = selectedDay === 'today' ? today : tomorrow;
            if (deliveryDate.getTime() !== targetDate.getTime()) {
              return false;
            }
          }
          
          // Filter by selected hour
          if (selectedHour && schedule.delivery_time_start) {
            const orderHour = schedule.delivery_time_start.split(':')[0];
            const selectedHourFormatted = selectedHour.split(':')[0];
            if (orderHour !== selectedHourFormatted) {
              return false;
            }
          }
          
          return true;
        } catch (error) {
          console.warn('Error parsing delivery date for hourly filter:', schedule.delivery_date, error);
          return false;
        }
      });
    }
    
    // Apply overdue date filtering for overdue tab
    if (statusFilter === 'overdue' && selectedOverdueDateFilter) {
      const now = new Date();
      const today = startOfDay(now);
      const yesterday = startOfDay(subDays(now, 1));
      const lastWeek = startOfDay(subDays(now, 7));
      
      result = result.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule || !schedule.delivery_date || !schedule.delivery_time_end) return false;
        
        try {
          const deliveryDateTime = new Date(`${schedule.delivery_date}T${schedule.delivery_time_end}`);
          if (isNaN(deliveryDateTime.getTime())) return false;
          
          switch (selectedOverdueDateFilter) {
            case 'today':
              return isSameDay(deliveryDateTime, today) || deliveryDateTime >= today;
            case 'yesterday':
              return isSameDay(deliveryDateTime, yesterday);
            case 'last_week':
              return deliveryDateTime >= lastWeek && deliveryDateTime < yesterday;
            case 'older':
              return deliveryDateTime < lastWeek;
            default:
              return true;
          }
        } catch (error) {
          console.warn('Error parsing delivery date for overdue filter:', schedule.delivery_date, error);
          return false;
        }
      });
    }
    
    return result;
  }, [prioritySortedOrders, deliverySchedules, deliveryFilter, statusFilter, selectedDay, selectedHour, selectedOverdueDateFilter]);

  // Calculate hourly order counts for confirmed orders
  const hourlyOrderCounts = useMemo(() => {
    if (statusFilter !== 'confirmed') return { today: {}, tomorrow: {} };
    
    const today = startOfDay(new Date());
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const counts = {
      today: {} as Record<string, number>,
      tomorrow: {} as Record<string, number>
    };
    
    // Initialize hourly slots
    for (let hour = 8; hour <= 22; hour++) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      counts.today[timeSlot] = 0;
      counts.tomorrow[timeSlot] = 0;
    }
    
    // Count orders for each hour
    prioritySortedOrders.forEach(order => {
      if (order.status !== 'confirmed' || order.payment_status !== 'paid') return;
      
      const schedule = deliverySchedules[order.id];
      if (!schedule || !schedule.delivery_date || !schedule.delivery_time_start) return;
      
      try {
        const deliveryDate = startOfDay(new Date(schedule.delivery_date));
        const orderHour = `${schedule.delivery_time_start.split(':')[0]}:00`;
        
        if (deliveryDate.getTime() === today.getTime()) {
          counts.today[orderHour] = (counts.today[orderHour] || 0) + 1;
        } else if (deliveryDate.getTime() === tomorrow.getTime()) {
          counts.tomorrow[orderHour] = (counts.tomorrow[orderHour] || 0) + 1;
        }
      } catch (error) {
        console.warn('Error processing order for hourly counts:', order.id, error);
      }
    });
    
    return counts;
  }, [prioritySortedOrders, deliverySchedules, statusFilter]);

  // Calculate overdue order counts by date ranges
  const overdueOrderCounts = useMemo(() => {
    if (statusFilter !== 'overdue') {
      return { today: 0, yesterday: 0, lastWeek: 0, older: 0 };
    }
    
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = startOfDay(subDays(now, 1));
    const lastWeek = startOfDay(subDays(now, 7));
    
    const counts = { today: 0, yesterday: 0, lastWeek: 0, older: 0 };
    
    // Filter for overdue orders (paid orders that are overdue and not delivered)
    const overdueOrders = orders.filter(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule) return false;
      
      return order.payment_status === 'paid' && 
             isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && 
             ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
    });
    
    overdueOrders.forEach(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule || !schedule.delivery_date || !schedule.delivery_time_end) return;
      
      try {
        const deliveryDate = new Date(schedule.delivery_date);
        const deliveryDateTime = new Date(`${schedule.delivery_date}T${schedule.delivery_time_end}`);
        
        if (isNaN(deliveryDateTime.getTime())) return;
        
        // Categorize based on when the order became overdue
        if (isSameDay(deliveryDateTime, today) || deliveryDateTime >= today) {
          counts.today++;
        } else if (isSameDay(deliveryDateTime, yesterday)) {
          counts.yesterday++;
        } else if (deliveryDateTime >= lastWeek) {
          counts.lastWeek++;
        } else {
          counts.older++;
        }
      } catch (error) {
        console.warn('Error processing overdue order for date counts:', order.id, error);
      }
    });
    
    return counts;
  }, [orders, deliverySchedules, statusFilter]);

  // Get order counts by status for tab badges
  const orderCounts = useMemo(() => {
    // Calculate overdue count with defensive date handling - paid orders only
    const overdueCount = orders.filter(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule || !schedule.delivery_date || !schedule.delivery_time_end) return false;
      
      try {
        return order.payment_status === 'paid' && 
               isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && 
               ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
      } catch (error) {
        console.warn('Error checking overdue status for order:', order.id, error);
        return false;
      }
    }).length;

    return {
      all: totalCount,
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed' && o.payment_status === 'paid').length, // Only paid confirmed orders
      preparing: orders.filter(o => o.status === 'preparing').length,
      out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      overdue: overdueCount
    };
  }, [orders, totalCount, deliverySchedules]);

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
    setStatusFilter(value as 'all' | OrderStatus | 'overdue');
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
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {filteredOrders.filter(o => {
                      const schedule = deliverySchedules[o.id];
                      return schedule && isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end);
                    }).length}
                  </p>
                  <p className="text-sm text-orange-600">Overdue Deliveries</p>
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

        {/* Orders Tabs - Fully Responsive */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="relative">
            {/* Mobile: Scrollable horizontal tabs */}
            <div className="block sm:hidden">
              <div className="overflow-x-auto pb-2 scrollbar-hide">
                <TabsList className="flex w-max min-w-full gap-1 p-1 bg-muted rounded-lg">
                  <TabsTrigger value="all" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 data-[state=active]:bg-background">
                    All ({orderCounts.all})
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 data-[state=active]:bg-background">
                    Pend ({orderCounts.pending})
                  </TabsTrigger>
                  <TabsTrigger value="confirmed" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 data-[state=active]:bg-background">
                    Conf ({orderCounts.confirmed})
                  </TabsTrigger>
                  <TabsTrigger value="preparing" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 data-[state=active]:bg-background">
                    Prep ({orderCounts.preparing})
                  </TabsTrigger>
                  <TabsTrigger value="out_for_delivery" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 data-[state=active]:bg-background">
                    Out ({orderCounts.out_for_delivery})
                  </TabsTrigger>
                  <TabsTrigger value="delivered" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 data-[state=active]:bg-background">
                    Del ({orderCounts.delivered})
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="text-xs whitespace-nowrap px-2 py-1.5 min-w-0 text-destructive data-[state=active]:bg-background">
                    Over ({orderCounts.overdue})
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            
            {/* Tablet: 4 columns with overflow */}
            <div className="hidden sm:block md:hidden">
              <TabsList className="grid w-full grid-cols-4 gap-1 p-1 bg-muted rounded-lg">
                <TabsTrigger value="all" className="text-xs px-1 py-2 data-[state=active]:bg-background">
                  All ({orderCounts.all})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-xs px-1 py-2 data-[state=active]:bg-background">
                  Pend ({orderCounts.pending})
                </TabsTrigger>
                <TabsTrigger value="confirmed" className="text-xs px-1 py-2 data-[state=active]:bg-background">
                  Conf ({orderCounts.confirmed})
                </TabsTrigger>
                <TabsTrigger value="preparing" className="text-xs px-1 py-2 data-[state=active]:bg-background">
                  Prep ({orderCounts.preparing})
                </TabsTrigger>
              </TabsList>
              <div className="mt-2">
                <TabsList className="grid w-full grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
                  <TabsTrigger value="out_for_delivery" className="text-xs px-1 py-2 data-[state=active]:bg-background">
                    Out ({orderCounts.out_for_delivery})
                  </TabsTrigger>
                  <TabsTrigger value="delivered" className="text-xs px-1 py-2 data-[state=active]:bg-background">
                    Del ({orderCounts.delivered})
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="text-xs px-1 py-2 text-destructive data-[state=active]:bg-background">
                    Over ({orderCounts.overdue})
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            
            {/* Desktop: Full grid layout */}
            <div className="hidden md:block">
              <TabsList className="grid w-full grid-cols-7 gap-1 p-1 bg-muted rounded-lg">
                <TabsTrigger value="all" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  All Orders ({orderCounts.all})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Pending ({orderCounts.pending})
                </TabsTrigger>
                <TabsTrigger value="confirmed" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Confirmed ({orderCounts.confirmed})
                </TabsTrigger>
                <TabsTrigger value="preparing" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Preparing ({orderCounts.preparing})
                </TabsTrigger>
                <TabsTrigger value="out_for_delivery" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Out for Delivery ({orderCounts.out_for_delivery})
                </TabsTrigger>
                <TabsTrigger value="delivered" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Delivered ({orderCounts.delivered})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="text-sm px-2 py-2 text-destructive data-[state=active]:bg-background">
                  Overdue ({orderCounts.overdue})
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
              {activeTab === 'overdue' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      Overdue Period Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OverdueDateFilter
                      selectedDateFilter={selectedOverdueDateFilter}
                      onDateFilterChange={setSelectedOverdueDateFilter}
                      overdueOrderCounts={overdueOrderCounts}
                    />
                  </CardContent>
                </Card>
              )}

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

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: OrderStatus }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update order status.",
        variant: "destructive",
      });
    }
  });

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
    updateStatusMutation.mutate({ orderId: order.id, newStatus });
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
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
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
                  disabled={updateStatusMutation.isPending}
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
                disabled={updateStatusMutation.isPending}
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
