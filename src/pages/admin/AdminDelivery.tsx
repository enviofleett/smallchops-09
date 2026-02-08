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
import { SafeUnifiedDeliveryManagement } from '@/components/admin/delivery/SafeUnifiedDeliveryManagement';
import { DriverPerformanceDashboard } from '@/components/admin/delivery/DriverPerformanceDashboard';
import { DriverRevenueTable } from '@/components/reports/advanced/DriverRevenueTable';
import { DeliveryFeesTable } from '@/components/reports/advanced/DeliveryFeesTable';
import { useDashboardAggregates } from '@/hooks/useDashboardAggregates';
import { usePaidOrders } from '@/hooks/usePaidOrders';
import { useOrderFilters } from '@/hooks/useOrderFilters';
import { DeliveryRouteManager } from '@/components/delivery/DeliveryRouteManager';
import { useIsMobile } from '@/hooks/use-mobile';
import { Truck, Clock, Users, Package, TrendingUp, CalendarIcon, AlertTriangle, RefreshCw, BarChartHorizontal } from 'lucide-react';
import { format, isToday, parseISO, isAfter, isBefore, addMinutes, subDays } from 'date-fns';
import { formatAddress } from '@/utils/formatAddress';
import { cn } from '@/lib/utils';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { DeliveryTabDropdown } from '@/components/admin/delivery/DeliveryTabDropdown';
import { isOrderOverdue } from '@/utils/scheduleTime';

// Responsive breakpoints for grid layouts
const GRID_BREAKPOINTS = {
  mobile: 'grid-cols-2',
  tablet: 'md:grid-cols-4',
  desktop: 'lg:grid-cols-4'
};
export default function AdminDelivery() {
  // STATE
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('drivers');
  const [selectedOrders, setSelectedOrders] = useState<OrderWithItems[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);
  const [deliveryWindowFilter, setDeliveryWindowFilter] = useState<string>('all');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Date range and interval for reports tabs
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');
  const isMobile = useIsMobile();
  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedDateToday = isToday(selectedDate);

  // Validate and normalize dates for reports
  const validStartDate = React.useMemo(() => {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [startDate]);
  const validEndDate = React.useMemo(() => {
    const date = new Date(endDate);
    date.setHours(23, 59, 59, 999);
    return date;
  }, [endDate]);

  // DATA FETCHING
  const {
    orders: paidOrders,
    isLoading: ordersLoading,
    error: ordersError,
    refresh: refreshOrders
  } = usePaidOrders({
    selectedDate,
    orderType: 'delivery',
    autoRefresh: isSelectedDateToday
  });
  const {
    filteredOrders: deliveryOrders,
    metrics: deliveryMetrics
  } = useOrderFilters({
    orders: paidOrders,
    selectedDate,
    orderType: 'delivery',
    paymentStatus: 'paid'
  });

  // Fetch driver revenue data for reports tab
  const { data: aggregates, isLoading: aggregatesLoading } = useDashboardAggregates(validStartDate, validEndDate, interval);
  const driverData = aggregates?.driverRevenue;

  // Ready Orders and Schedules
  const readyOrdersBasic = useMemo(() => deliveryOrders.filter(order => order.status === 'ready'), [deliveryOrders]);
  const readyOrderIds = useMemo(() => readyOrdersBasic.map(order => order.id), [readyOrdersBasic]);
  const {
    data: deliverySchedules = {},
    error: schedulesError
  } = useQuery({
    queryKey: ['delivery-schedules-bulk', readyOrderIds],
    queryFn: () => getSchedulesByOrderIds(readyOrderIds),
    enabled: readyOrderIds.length > 0
  });

  // SORTED READY ORDERS (by priority)
  const readyOrders = useMemo(() => {
    return [...readyOrdersBasic].sort((a, b) => {
      const scheduleA = deliverySchedules[a.id];
      const scheduleB = deliverySchedules[b.id];
      if (scheduleA && scheduleB) {
        const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
        const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
        return dateTimeA.getTime() - dateTimeB.getTime();
      }
      if (scheduleA && !scheduleB) return -1;
      if (!scheduleA && scheduleB) return 1;
      return new Date(a.order_time || a.created_at).getTime() - new Date(b.order_time || b.created_at).getTime();
    });
  }, [readyOrdersBasic, deliverySchedules]);
  const {
    zones,
    loading: zonesLoading
  } = useDeliveryZones();

  // DELIVERY WINDOWS GENERATION
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

  // FILTER ORDERS BY WINDOW
  const filteredOrdersByWindow = useMemo(() => {
    if (deliveryWindowFilter === 'all') return [...deliveryOrders];
    if (deliveryWindowFilter === 'due-now') {
      const now = new Date();
      return deliveryOrders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule?.delivery_time_start || !schedule?.delivery_time_end) return false;
        try {
          const today = format(selectedDate, 'yyyy-MM-dd');
          const startTime = parseISO(`${today}T${schedule.delivery_time_start}:00`);
          const endTime = parseISO(`${today}T${schedule.delivery_time_end}:00`);
          const bufferStart = addMinutes(startTime, -30);
          return isAfter(now, bufferStart) && isBefore(now, endTime) || isAfter(now, startTime);
        } catch {
          return false;
        }
      });
    }
    if (deliveryWindowFilter === 'overdue') {
      return deliveryOrders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule?.delivery_time_end) return false;
        try {
          return isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && ['confirmed', 'preparing', 'ready'].includes(order.status);
        } catch {
          return false;
        }
      });
    }
    const [startHour] = deliveryWindowFilter.split('-');
    return deliveryOrders.filter(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule?.delivery_time_start) return false;
      return schedule.delivery_time_start.startsWith(startHour);
    });
  }, [deliveryOrders, deliveryWindowFilter, deliverySchedules, selectedDate]);

  // RESET SELECTION ON WINDOW FILTER CHANGE
  React.useEffect(() => {
    setSelectedOrders(prev => prev.filter(order => filteredOrdersByWindow.some(filtered => filtered.id === order.id)));
  }, [deliveryWindowFilter]);

  // FINAL METRICS
  const finalDeliveryMetrics = useMemo(() => ({
    ...deliveryMetrics,
    inProgress: deliveryOrders.filter(o => ['preparing', 'ready'].includes(o.status)).length,
    outForDelivery: deliveryOrders.filter(o => o.status === 'out_for_delivery').length,
    assigned: deliveryOrders.filter(o => o.assigned_rider_id).length
  }), [deliveryOrders, deliveryMetrics]);

  // DRIVER TRIP ANALYTICS
  const driverTripCounts = useMemo(() => {
    const tripMap: Record<string, number> = {};
    deliveryOrders.forEach(order => {
      if (order.assigned_rider_id && order.status === 'out_for_delivery') {
        tripMap[order.assigned_rider_id] = (tripMap[order.assigned_rider_id] || 0) + 1;
      }
    });
    return tripMap;
  }, [deliveryOrders]);

  // For demonstration: mapping driver ID to name
  const getDriverName = (driverId: string) => `Driver ${driverId.substring(0, 6)}`;

  // Responsive grid classes
  const gridClasses = isMobile ? 'grid-cols-2' : 'md:grid-cols-4';
  return <>
      {/* SEO */}
      <Helmet>
        <title>Delivery Management - Admin Dashboard</title>
        <meta name="description" content="Manage delivery operations, track routes, and monitor delivery performance." />
      </Helmet>

      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Delivery Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Monitor delivery operations, routes, and performance metrics
            </p>
          </div>
          
          {/* Show date range filters for report tabs */}
          {activeTab === 'driver-revenue' || activeTab === 'delivery-fees' ? <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Select value={interval} onValueChange={(v: 'day' | 'week' | 'month') => setInterval(v)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(!startDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={date => {
                if (date) {
                  const normalizedDate = new Date(date);
                  normalizedDate.setHours(0, 0, 0, 0);
                  if (normalizedDate > endDate) {
                    setStartDate(normalizedDate);
                    setEndDate(normalizedDate);
                  } else {
                    setStartDate(normalizedDate);
                  }
                }
              }} disabled={date => date > new Date() || date > endDate} initialFocus className="p-3" />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(!endDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={date => {
                if (date) {
                  const normalizedDate = new Date(date);
                  normalizedDate.setHours(23, 59, 59, 999);
                  if (normalizedDate < startDate) {
                    setStartDate(normalizedDate);
                    setEndDate(normalizedDate);
                  } else {
                    setEndDate(normalizedDate);
                  }
                }
              }} disabled={date => date < startDate || date > new Date()} initialFocus className="p-3" />
                </PopoverContent>
              </Popover>
            </div> : <div className="flex gap-2 w-full sm:w-auto">
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" aria-label="Pick a date" className={cn("w-full sm:w-[200px] md:w-[240px] justify-start text-left font-normal text-sm", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align={isMobile ? "center" : "start"} side={isMobile ? "bottom" : "bottom"} sideOffset={4}>
                  <Calendar mode="single" selected={selectedDate} onSelect={date => {
                if (date) {
                  setSelectedDate(date);
                  setIsCalendarOpen(false);
                }
              }} initialFocus className="pointer-events-auto bg-background border rounded-md shadow-lg" />
                </PopoverContent>
              </Popover>
            </div>}
        </div>

        {/* Overdue & Efficiency Overview */}
        {(activeTab === 'drivers' || activeTab === 'zones' || activeTab === 'driver-revenue' || activeTab === 'delivery-fees') && aggregates && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Card>
               <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                 <CardTitle className="text-sm font-medium">Overdue Orders</CardTitle>
                 <AlertTriangle className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{aggregates.overdueStats?.total_overdue || 0}</div>
                 <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                   <span className="text-red-500 font-medium">{aggregates.overdueStats?.critical || 0} Critical</span>
                   <span>•</span>
                   <span className="text-orange-500 font-medium">{aggregates.overdueStats?.moderate || 0} Moderate</span>
                 </div>
               </CardContent>
             </Card>
             <Card>
               <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                 <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
                 <Clock className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{aggregates.efficiencyStats?.average_delivery_time_minutes?.toFixed(1) || 0} min</div>
                 <p className="text-xs text-muted-foreground">
                    Based on {aggregates.efficiencyStats?.orders_per_driver_avg ? 'recent' : 'no'} data
                 </p>
               </CardContent>
             </Card>
             <Card>
               <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                 <CardTitle className="text-sm font-medium">Top Zone</CardTitle>
                 <TrendingUp className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold truncate">
                    {aggregates.zoneBreakdown?.[0]?.zone_name || 'N/A'}
                 </div>
                 <p className="text-xs text-muted-foreground">
                    {aggregates.zoneBreakdown?.[0]?.total_orders || 0} orders
                 </p>
               </CardContent>
             </Card>
          </div>
        )}

        {/* Error Banner */}
        {ordersError && <ErrorBanner icon={<AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />} title="Failed to load orders data" description={ordersError instanceof Error ? ordersError.message : 'Unknown error occurred'} color="destructive" />}

        {/* Server Cap Warning */}
        {deliveryOrders.length >= 1000 && <ErrorBanner icon={<AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />} title={`Maximum data limit reached (${deliveryOrders.length} orders)`} description="Some orders may not be displayed. Consider narrowing your date range." color="orange-500" />}

        {/* Delivery Metrics - Only show for drivers/zones tabs */}
        {(activeTab === 'drivers' || activeTab === 'zones') && <div className={`grid ${gridClasses} gap-2 sm:gap-3 md:gap-4 mx-2 sm:mx-0`}>
            <MetricCard icon={<Package className="w-4 h-4 sm:w-5 sm:h-5" />} label="Total" value={finalDeliveryMetrics.totalOrders} color="primary" />
            <MetricCard icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />} label="Progress" value={finalDeliveryMetrics.inProgress} color="orange-500" />
            <MetricCard icon={<Truck className="w-4 h-4 sm:w-5 sm:h-5" />} label="Delivery" value={finalDeliveryMetrics.outForDelivery} color="purple-500" />
            <MetricCard icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />} label="Assigned" value={finalDeliveryMetrics.assigned} color="green-500" />
          </div>}

        {/* Main Tabs - Responsive */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="relative">
            {/* Mobile & Tablet: Dropdown */}
            <div className="block lg:hidden mb-4">
              <DeliveryTabDropdown activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
            
            {/* Desktop: Grid layout */}
            <div className="hidden lg:block">
              <TabsList className="grid w-full grid-cols-4 gap-1 p-1 bg-muted rounded-lg">
                {[{
                value: 'drivers',
                label: 'Drivers'
              }, {
                value: 'zones',
                label: 'Delivery Zones'
              }, {
                value: 'driver-revenue',
                label: 'Driver Revenue'
              }, {
                value: 'delivery-fees',
                label: 'Delivery Fees'
              }].map(tab => <TabsTrigger key={tab.value} value={tab.value} className="text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {tab.label}
                  </TabsTrigger>)}
              </TabsList>
            </div>
          </div>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <AdminDriversTab />
          </TabsContent>

          {/* Delivery Zones Tab */}
          <TabsContent value="zones">
            <DeliveryZonesManager />
          </TabsContent>

          {/* Driver Revenue Tab */}
          <TabsContent value="driver-revenue" className="space-y-4">
            <DriverRevenueTable data={driverData} isLoading={aggregatesLoading} />
          </TabsContent>

          {/* Delivery Fees Tab */}
          <TabsContent value="delivery-fees" className="space-y-4">
            <DeliveryFeesTable 
              startDate={validStartDate} 
              endDate={validEndDate} 
              interval={interval} 
              zoneBreakdown={aggregates?.zoneBreakdown}
              driverRevenue={aggregates?.driverRevenue}
              isLoading={aggregatesLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Driver Registration Dialog */}
        <DriverDialog open={isRegisterDriverOpen} onOpenChange={setIsRegisterDriverOpen} onSave={async data => {
        console.log('Driver registration:', data);
        setIsRegisterDriverOpen(false);
      }} />

        {/* Driver Assignment Dialog */}
        <DriverAssignDialog isOpen={isDriverDialogOpen} onClose={() => setIsDriverDialogOpen(false)} selectedOrders={selectedOrders} onSuccess={() => {
        setSelectedOrders([]);
        setIsDriverDialogOpen(false);
        refreshOrders();
      }} />
      </div>
    </>;
}

// Helper: MetricCard
function MetricCard({
  icon,
  label,
  value,
  color = 'primary'
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}) {
  const colorClass = {
    'primary': 'bg-primary/10 text-primary',
    'orange-500': 'bg-orange-500/10 text-orange-600',
    'purple-500': 'bg-purple-500/10 text-purple-600',
    'green-500': 'bg-green-500/10 text-green-600'
  }[color] || color;
  return <Card className="overflow-hidden">
      
    </Card>;
}

// Helper: LoadingSkeleton
function LoadingSkeleton({
  rows = 3
}: {
  rows?: number;
}) {
  return <div className="space-y-3">
      {[...Array(rows)].map((_, i) => <div key={i} className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>)}
    </div>;
}

// Helper: ErrorBanner
function ErrorBanner({
  icon,
  title,
  description,
  color = 'destructive'
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color?: string;
}) {
  const colorClass = {
    destructive: 'bg-destructive/10 border border-destructive/20',
    'orange-500': 'bg-orange-500/10 border border-orange-500/20'
  }[color] || color;
  const textColor = color === 'orange-500' ? 'text-orange-600' : 'text-destructive';
  return <div className={`${colorClass} rounded-lg p-3 sm:p-4 mx-2 sm:mx-0`}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${textColor} font-medium`}>
            {title}
          </p>
          <p className={`text-xs ${textColor}/80 mt-1 break-words`}>
            {description}
          </p>
        </div>
      </div>
    </div>;
}

// Helper: DeliveryOrderItem
function DeliveryOrderItem({
  order
}: {
  order: OrderWithItems;
}) {
  return <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="font-medium truncate">{order.order_number}</p>
        <p className="text-sm text-muted-foreground truncate">{order.customer_name}</p>
      </div>
      <Badge variant={order.status === 'confirmed' ? 'default' : order.status === 'preparing' ? 'secondary' : order.status === 'ready' ? 'outline' : order.status === 'out_for_delivery' ? 'destructive' : 'outline'}>
        {order.status?.replace(/_/g, ' ') || 'Unknown'}
      </Badge>
    </div>;
}
