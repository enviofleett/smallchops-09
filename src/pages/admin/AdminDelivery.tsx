import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { getSchedulesByOrderIds } from '@/api/deliveryScheduleApi';
import { DriverAssignDialog } from '@/components/admin/delivery/DriverAssignDialog';
import { ShippingFeesReport } from '@/components/admin/delivery/ShippingFeesReport';
import { DriverDialog } from '@/components/delivery/DriverDialog';
import { AdminDriversTab } from '@/components/admin/delivery/AdminDriversTab';
import { DeliveryZonesManager } from '@/components/delivery/DeliveryZonesManager';
import { UnifiedDeliveryManagement } from '@/components/admin/delivery/UnifiedDeliveryManagement';
import { DriverPerformanceDashboard } from '@/components/admin/delivery/DriverPerformanceDashboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Truck, 
  Clock,
  Users,
  Package,
  TrendingUp,
  CalendarIcon,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { format, isToday, parseISO, isAfter, isBefore, addMinutes } from 'date-fns';
import { SystemStatusChecker } from '@/components/admin/SystemStatusChecker';
import { formatAddress } from '@/utils/formatAddress';
import { cn } from '@/lib/utils';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { isOrderOverdue } from '@/utils/scheduleTime';

export default function AdminDelivery() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOrders, setSelectedOrders] = useState<OrderWithItems[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);
  const [deliveryWindowFilter, setDeliveryWindowFilter] = useState<string>('all');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const isMobile = useIsMobile();

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedDateToday = isToday(selectedDate);

  // Fetch delivery orders - all orders for the selected date
  const { data: deliveryOrdersData, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['delivery-orders', selectedDateString],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 1000, // Get all orders for the date
      status: undefined,
      startDate: selectedDateString,
      endDate: selectedDateString,
    }),
    // Removed automatic polling - use manual refresh instead
  });

  // Filter for paid delivery orders only (all statuses for metrics)
  const deliveryOrders = deliveryOrdersData?.orders?.filter(order => 
    order.order_type === 'delivery' && 
    order.payment_status === 'paid' &&
    ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)
  ) || [];

  // Get ready orders first
  const readyOrdersBasic = deliveryOrders.filter(order => order.status === 'ready');
  
  // Fetch delivery schedules in bulk for ready orders only
  const readyOrderIds = readyOrdersBasic.map(order => order.id);
  const { data: deliverySchedules = {}, error: schedulesError } = useQuery({
    queryKey: ['delivery-schedules-bulk', readyOrderIds],
    queryFn: () => getSchedulesByOrderIds(readyOrderIds),
    enabled: readyOrderIds.length > 0,
  });

  // Sort ready orders by delivery priority
  const readyOrders = useMemo(() => 
    readyOrdersBasic.sort((a, b) => {
      const scheduleA = deliverySchedules[a.id];
      const scheduleB = deliverySchedules[b.id];
      
      // Priority: orders with schedules first, then by earliest delivery time
      if (scheduleA && scheduleB) {
        const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
        const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
        return dateTimeA.getTime() - dateTimeB.getTime();
      }
      
      if (scheduleA && !scheduleB) return -1;
      if (!scheduleA && scheduleB) return 1;
      
      // Fallback to order time
      return new Date(a.order_time || a.created_at).getTime() - 
             new Date(b.order_time || b.created_at).getTime();
    }),
    [readyOrdersBasic, deliverySchedules]
  );

  // Fetch delivery zones
  const { zones, loading: zonesLoading } = useDeliveryZones();

  // Generate hourly delivery windows
  const deliveryWindows = useMemo(() => {
    const windows = ['all'];
    for (let hour = 8; hour <= 20; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      windows.push(`${startTime}-${endTime}`);
    }
    windows.push('due-now', 'overdue');
    return windows;
  }, []);

  // Filter ready orders by delivery window (for Delivery Orders tab)
  const readyFilteredOrders = useMemo(() => {
    if (deliveryWindowFilter === 'all') return readyOrders;
    
    if (deliveryWindowFilter === 'due-now') {
      const now = new Date();
      
      return readyOrders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule?.delivery_time_start || !schedule?.delivery_time_end) return false;
        
        try {
          // Create timezone-safe date comparisons
          const today = format(selectedDate, 'yyyy-MM-dd');
          const startTime = parseISO(`${today}T${schedule.delivery_time_start}:00`);
          const endTime = parseISO(`${today}T${schedule.delivery_time_end}:00`);
          
          // Add some buffer for "due now" (within 30 minutes)
          const bufferStart = addMinutes(startTime, -30);
          
          return (isAfter(now, bufferStart) && isBefore(now, endTime)) || isAfter(now, startTime);
        } catch {
          return false;
        }
      });
    }
    
    if (deliveryWindowFilter === 'overdue') {
      const now = new Date();
      
      return readyOrders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule?.delivery_time_end) return false;
        
        try {
          const today = format(selectedDate, 'yyyy-MM-dd');
          const endTime = parseISO(`${today}T${schedule.delivery_time_end}:00`);
          return isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && 
                 ['confirmed', 'preparing', 'ready'].includes(order.status);
        } catch {
          return false;
        }
      });
    }
    
    const [startHour] = deliveryWindowFilter.split('-');
    return readyOrders.filter(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule?.delivery_time_start) return false;
      return schedule.delivery_time_start.startsWith(startHour);
    });
  }, [readyOrders, deliveryWindowFilter, deliverySchedules, selectedDate]);

  // Reset selection when window filter changes
  React.useEffect(() => {
    setSelectedOrders(prev => prev.filter(order => 
      readyFilteredOrders.some(filtered => filtered.id === order.id)
    ));
  }, [deliveryWindowFilter, readyFilteredOrders]);

  // Calculate delivery metrics
  const deliveryMetrics = {
    totalDeliveries: deliveryOrders.length,
    inProgress: deliveryOrders.filter(o => ['preparing', 'ready'].includes(o.status)).length,
    outForDelivery: deliveryOrders.filter(o => o.status === 'out_for_delivery').length,
    assigned: deliveryOrders.filter(o => o.assigned_rider_id).length,
  };

  return (
    <>
      <Helmet>
        <title>Delivery Management - Admin Dashboard</title>
        <meta name="description" content="Manage delivery operations, track routes, and monitor delivery performance." />
      </Helmet>

      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* System Status Check */}
        <SystemStatusChecker />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Delivery Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Monitor delivery operations, routes, and performance metrics
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal text-sm",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0 z-50" 
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto bg-background border rounded-md shadow-lg"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Error Banner */}
        {ordersError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive font-medium">
                  Failed to load orders data
                </p>
                <p className="text-xs text-destructive/80 mt-1 break-words">
                  {ordersError instanceof Error ? ordersError.message : 'Unknown error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Server Cap Warning */}
        {(deliveryOrdersData?.count === 1000 || 
          deliveryOrdersData?.orders?.length === 1000) && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-orange-600 font-medium">
                  Maximum data limit reached ({deliveryOrdersData?.orders?.length || 1000} orders)
                </p>
                <p className="text-xs text-orange-600/80 mt-1 break-words">
                  Some orders may not be displayed. Consider narrowing your date range.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mx-2 sm:mx-0">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-primary/10 text-primary rounded-lg flex-shrink-0">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold truncate">{deliveryMetrics.totalDeliveries}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-orange-500/10 text-orange-600 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Progress</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold truncate">{deliveryMetrics.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-500/10 text-purple-600 rounded-lg flex-shrink-0">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Delivery</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold truncate">{deliveryMetrics.outForDelivery}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-500/10 text-green-600 rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Assigned</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold truncate">{deliveryMetrics.assigned}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs - Mobile Responsive */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="relative">
            {/* Mobile: Scrollable horizontal tabs */}
            <div className="sm:hidden">
              <div className="overflow-x-auto pb-2 scrollbar-hide">
                <TabsList className="flex w-max min-w-full gap-1 p-1 bg-muted rounded-lg">
                  <TabsTrigger value="overview" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="ready-orders" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Ready
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    All Orders
                  </TabsTrigger>
                  <TabsTrigger value="drivers" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Drivers
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
                    Overdue
                  </TabsTrigger>
                  <TabsTrigger value="zones" className="text-xs whitespace-nowrap px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    Delivery Zones
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            
            {/* Desktop: Grid layout */}
            <div className="hidden sm:block">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 gap-1 p-1 bg-muted rounded-lg">
                <TabsTrigger value="overview" className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="ready-orders" className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Ready
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  All Orders
                </TabsTrigger>
                <TabsTrigger value="drivers" className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Drivers
                </TabsTrigger>
                <TabsTrigger value="analytics" className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="overdue" className="text-sm px-2 py-2 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
                  Overdue
                </TabsTrigger>
                <TabsTrigger value="zones" className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Delivery Zones
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Delivery Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Recent Delivery Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4"></div>
                          <div className="h-3 bg-muted rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {deliveryOrders.slice(0, 5).map((order) => (
                        <DeliveryOrderItem key={order.id} order={order} />
                      ))}
                      {deliveryOrders.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No delivery orders for today
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shipping Fees Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Shipping Fees Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ShippingFeesReport />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Ready Orders Tab - New Enhanced Management */}
          <TabsContent value="ready-orders" className="space-y-6">
            {/* Delivery Window Filter */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Delivery Window Filter
                  </CardTitle>
                  <Badge variant="outline">
                    {readyFilteredOrders.length} of {readyOrders.length} orders
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Select value={deliveryWindowFilter} onValueChange={setDeliveryWindowFilter}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Filter by delivery window" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryWindows.map((window) => (
                      <SelectItem key={window} value={window}>
                        {window === 'all' ? 'All Times' :
                         window === 'due-now' ? '🔥 Due Now (Next 30min)' :
                         window === 'overdue' ? '⚠️ Overdue' :
                         window}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <UnifiedDeliveryManagement 
              mode="ready" 
              ordersOverride={readyFilteredOrders}
            />
          </TabsContent>

          {/* All Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <UnifiedDeliveryManagement mode="all" selectedDate={selectedDate} />
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <AdminDriversTab />
          </TabsContent>

          {/* Delivery Zones Tab */}
          <TabsContent value="zones">
            <DeliveryZonesManager />
          </TabsContent>
        </Tabs>

        {/* Driver Registration Dialog */}
        <DriverDialog 
          open={isRegisterDriverOpen}
          onOpenChange={setIsRegisterDriverOpen}
          onSave={async (data) => {
            console.log('Driver registration:', data);
            setIsRegisterDriverOpen(false);
          }}
        />

        {/* Driver Assignment Dialog */}
        <DriverAssignDialog
          isOpen={isDriverDialogOpen}
          onClose={() => setIsDriverDialogOpen(false)}
          selectedOrders={selectedOrders}
          onSuccess={() => {
            setSelectedOrders([]);
            setIsDriverDialogOpen(false);
            refetchOrders();
          }}
        />
      </div>
    </>
  );
}

// Helper components
function DeliveryOrderItem({ order }: { order: OrderWithItems }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="font-medium truncate">{order.order_number}</p>
        <p className="text-sm text-muted-foreground truncate">{order.customer_name}</p>
      </div>
      <Badge variant={
        order.status === 'confirmed' ? 'default' :
        order.status === 'preparing' ? 'secondary' :
        order.status === 'ready' ? 'outline' :
        order.status === 'out_for_delivery' ? 'destructive' : 'outline'
      }>
        {order.status?.replace(/_/g, ' ') || 'Unknown'}
      </Badge>
    </div>
  );
}

