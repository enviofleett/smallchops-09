import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { useDeliveryZones } from '@/hooks/useDeliveryTracking';
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { getSchedulesByOrderIds } from '@/api/deliveryScheduleApi';
import { DriverAssignDialog } from '@/components/admin/delivery/DriverAssignDialog';
import { ShippingFeesReport } from '@/components/admin/delivery/ShippingFeesReport';
import { DriverDialog } from '@/components/delivery/DriverDialog';
import { AdminDriversTab } from '@/components/admin/delivery/AdminDriversTab';
import { DeliveryZonesManager } from '@/components/delivery/DeliveryZonesManager';
import { 
  MapPin, 
  Truck, 
  Clock,
  Users,
  Package,
  TrendingUp,
  CalendarIcon,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { SystemStatusChecker } from '@/components/admin/SystemStatusChecker';
import { formatAddress } from '@/utils/formatAddress';
import { cn } from '@/lib/utils';

export default function AdminDelivery() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);
  const [deliveryWindowFilter, setDeliveryWindowFilter] = useState<string>('all');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
    refetchInterval: isSelectedDateToday ? 30000 : undefined, // Only poll for today
  });

  // Filter for paid delivery orders only (all statuses for metrics)
  const deliveryOrders = deliveryOrdersData?.orders?.filter(order => 
    order.order_type === 'delivery' && 
    order.payment_status === 'paid' &&
    ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)
  ) || [];

  // Filter for ready orders only (for Delivery Orders tab)
  const readyOrders = deliveryOrders.filter(order => order.status === 'ready');

  // Fetch delivery schedules in bulk for ready orders only
  const readyOrderIds = readyOrders.map(order => order.id);
  const { data: deliverySchedules = {}, error: schedulesError } = useQuery({
    queryKey: ['delivery-schedules-bulk', readyOrderIds],
    queryFn: () => getSchedulesByOrderIds(readyOrderIds),
    enabled: readyOrderIds.length > 0,
  });

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
    windows.push('due-now');
    return windows;
  }, []);

  // Filter ready orders by delivery window (for Delivery Orders tab)
  const readyFilteredOrders = useMemo(() => {
    if (deliveryWindowFilter === 'all') return readyOrders;
    if (deliveryWindowFilter === 'due-now') {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      return readyOrders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule) return false;
        return currentTime >= schedule.delivery_time_start && currentTime <= schedule.delivery_time_end;
      });
    }
    
    const [startHour] = deliveryWindowFilter.split('-');
    return readyOrders.filter(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule) return false;
      return schedule.delivery_time_start.startsWith(startHour);
    });
  }, [readyOrders, deliveryWindowFilter, deliverySchedules]);

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
        {deliveryOrdersData?.count === 1000 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-orange-600 font-medium">
                  Maximum data limit reached (1000 orders)
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

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs sm:text-sm">Delivery Orders</TabsTrigger>
            <TabsTrigger value="drivers" className="text-xs sm:text-sm">Drivers</TabsTrigger>
            <TabsTrigger value="zones" className="text-xs sm:text-sm">Zones</TabsTrigger>
          </TabsList>

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

          {/* Delivery Orders Tab */}
          <TabsContent value="orders" className="space-y-4 px-2 sm:px-0">
            {/* Header */}
            <div className="border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold truncate">Ready Delivery Orders</h2>
                  <p className="text-sm text-muted-foreground">
                    Showing only orders with status READY
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    Ready: {readyOrders.length}
                  </Badge>
                  {selectedOrders.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Selected: {selectedOrders.length}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <Select value={deliveryWindowFilter} onValueChange={setDeliveryWindowFilter}>
                <SelectTrigger className="w-full sm:w-48 h-9 text-sm bg-background border-input">
                  <SelectValue placeholder="Filter by time window" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border shadow-lg z-50">
                  {deliveryWindows.map((window) => (
                    <SelectItem key={window} value={window}>
                      {window === 'all' ? 'All Time Windows' : 
                       window === 'due-now' ? 'Due Now' : 
                       window.replace('-', ':00 - ') + ':00'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                {readyFilteredOrders.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedOrders.length === readyFilteredOrders.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOrders(readyFilteredOrders);
                        } else {
                          setSelectedOrders([]);
                        }
                      }}
                    />
                    <span className="text-sm text-muted-foreground">Select All in View</span>
                  </div>
                )}
                
                {selectedOrders.length > 0 && (
                  <Button 
                    onClick={() => setIsDriverDialogOpen(true)}
                    className="w-full sm:w-auto sm:ml-auto"
                    size="sm"
                  >
                    <span className="hidden sm:inline">Assign Driver</span>
                    <span className="sm:hidden">Assign</span>
                    <span className="ml-1">({selectedOrders.length})</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Error state for schedules */}
            {schedulesError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 sm:p-4">
                <p className="text-sm text-destructive break-words">
                  Failed to load delivery schedules. Some features may not work properly.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:gap-4">
              {ordersLoading ? (
                [...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4 sm:p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4 sm:w-1/4"></div>
                      <div className="h-4 bg-muted rounded w-full sm:w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-2/3 sm:w-1/3"></div>
                    </div>
                  </Card>
                ))
              ) : (
                readyFilteredOrders.map((order) => (
                  <DeliveryOrderCard 
                    key={order.id} 
                    order={order} 
                    schedule={deliverySchedules[order.id]}
                    onSelect={(selected) => {
                      if (selected) {
                        setSelectedOrders(prev => [...prev, order]);
                      } else {
                        setSelectedOrders(prev => prev.filter(o => o.id !== order.id));
                      }
                    }}
                    isSelected={selectedOrders.some(o => o.id === order.id)}
                    onAssignDriver={() => {
                      setSelectedOrders([order]);
                      setIsDriverDialogOpen(true);
                    }}
                  />
                ))
              )}
              
              {!ordersLoading && readyFilteredOrders.length === 0 && (
                <Card>
                  <CardContent className="p-8 sm:p-12 text-center">
                    <Package className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2">No ready orders</h3>
                    <p className="text-sm sm:text-base text-muted-foreground break-words">
                      {deliveryWindowFilter === 'all' 
                        ? 'No ready orders found for the selected date'
                        : 'No ready orders in this time window'
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
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
function DeliveryOrderItem({ order }: { order: any }) {
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
        order.status === 'out_for_delivery' ? 'default' : 'secondary'
      }>
        {order.status.replace('_', ' ')}
      </Badge>
    </div>
  );
}

function DeliveryOrderCard({ 
  order, 
  schedule, 
  onSelect, 
  isSelected, 
  onAssignDriver 
}: { 
  order: any; 
  schedule: any; 
  onSelect: (selected: boolean) => void;
  isSelected: boolean;
  onAssignDriver: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="flex-shrink-0 mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm sm:text-base truncate">{order.order_number}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{order.customer_name}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
            {order.assigned_rider_id ? (
              <Button 
                size="sm" 
                variant="outline"
                onClick={onAssignDriver}
                className="text-xs h-7 px-2"
              >
                <span className="hidden sm:inline">Reassign</span>
                <span className="sm:hidden">Re</span>
              </Button>
            ) : (
              <Button 
                size="sm"
                onClick={onAssignDriver}
                className="text-xs h-7 px-2"
              >
                <span className="hidden sm:inline">Assign</span>
                <span className="sm:hidden">As</span>
              </Button>
            )}
            <Badge variant="outline" className="text-xs px-1">Ready</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 sm:pb-4">
        <div className="space-y-2 sm:space-y-3">
          {/* Delivery Schedule */}
          {schedule && (
            <div className="bg-muted/30 rounded-md p-2 sm:p-3">
              <DeliveryScheduleDisplay 
                schedule={schedule}
                orderType="delivery"
                orderStatus={order.status}
              />
            </div>
          )}
          
          {/* Order Details */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium text-sm sm:text-base">₦{order.total_amount?.toLocaleString()}</span>
          </div>
          
          {/* Delivery Address */}
          {order.delivery_address && (
            <div className="flex items-start gap-2 text-xs sm:text-sm">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-xs">Address:</p>
                <p className="text-xs sm:text-sm break-words leading-relaxed">
                  {formatAddress(order.delivery_address)}
                </p>
              </div>
            </div>
          )}
          
          {/* Special Instructions Fallback */}
          {!schedule?.special_instructions && (order.special_instructions || order.items?.some((item: any) => item.special_instructions)) && (
            <div className="flex items-start gap-2 text-xs sm:text-sm">
              <div className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0 border border-blue-600 rounded-sm flex items-center justify-center">
                <span className="text-[8px] font-bold">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-xs">Special Instructions:</p>
                <p className="text-xs sm:text-sm break-words leading-relaxed">
                  {order.special_instructions || 
                   order.items?.find((item: any) => item.special_instructions)?.special_instructions ||
                   'See order details'}
                </p>
              </div>
            </div>
          )}
          
          {/* Delivery Fee */}
          {order.delivery_fee && order.delivery_fee > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee:</span>
              <span className="text-xs sm:text-sm">₦{order.delivery_fee?.toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
