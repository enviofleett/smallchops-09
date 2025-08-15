import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  UserPlus,
  CheckSquare,
  Square
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { SystemStatusChecker } from '@/components/admin/SystemStatusChecker';

export default function AdminDelivery() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);
  const [deliveryWindowFilter, setDeliveryWindowFilter] = useState<string>('all');

  // Fetch delivery orders - only paid delivery orders
  const { data: deliveryOrdersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['delivery-orders', selectedDate],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 100,
      status: undefined,
    }),
    refetchInterval: 30000,
  });

  // Filter for paid delivery orders only
  const deliveryOrders = deliveryOrdersData?.orders?.filter(order => 
    order.order_type === 'delivery' && 
    order.payment_status === 'paid' &&
    ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)
  ) || [];

  // Fetch delivery schedules in bulk for better performance
  const orderIds = deliveryOrders.map(order => order.id);
  const { data: deliverySchedules = {} } = useQuery({
    queryKey: ['delivery-schedules-bulk', orderIds],
    queryFn: () => getSchedulesByOrderIds(orderIds),
    enabled: orderIds.length > 0,
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

  // Filter orders by delivery window
  const filteredOrders = useMemo(() => {
    if (deliveryWindowFilter === 'all') return deliveryOrders;
    if (deliveryWindowFilter === 'due-now') {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      return deliveryOrders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule) return false;
        return currentTime >= schedule.delivery_time_start && currentTime <= schedule.delivery_time_end;
      });
    }
    
    const [startHour] = deliveryWindowFilter.split('-');
    return deliveryOrders.filter(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule) return false;
      return schedule.delivery_time_start.startsWith(startHour);
    });
  }, [deliveryOrders, deliveryWindowFilter, deliverySchedules]);

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

      <div className="space-y-6">
        {/* System Status Check */}
        <SystemStatusChecker />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Delivery Management</h1>
            <p className="text-muted-foreground">
              Monitor delivery operations, routes, and performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={format(new Date(), 'yyyy-MM-dd')}>Today</SelectItem>
                <SelectItem value={format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')}>Tomorrow</SelectItem>
                <SelectItem value={format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')}>Yesterday</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsRegisterDriverOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Register Driver
            </Button>
          </div>
        </div>

        {/* Delivery Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deliveries</p>
                  <p className="text-2xl font-bold">{deliveryMetrics.totalDeliveries}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{deliveryMetrics.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Out for Delivery</p>
                  <p className="text-2xl font-bold">{deliveryMetrics.outForDelivery}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="text-2xl font-bold">{deliveryMetrics.assigned}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Delivery Orders</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="zones">Delivery Zones</TabsTrigger>
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
          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Select value={deliveryWindowFilter} onValueChange={setDeliveryWindowFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by time window" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryWindows.map((window) => (
                    <SelectItem key={window} value={window}>
                      {window === 'all' ? 'All Orders' : 
                       window === 'due-now' ? 'Due Now' : 
                       window.replace('-', ':00 - ') + ':00'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedOrders.length > 0 && (
                <Button 
                  onClick={() => setIsDriverDialogOpen(true)}
                  className="ml-auto"
                >
                  Assign Driver ({selectedOrders.length})
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              {ordersLoading ? (
                [...Array(5)].map((_, i) => (
                  <Card key={i} className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                    </div>
                  </Card>
                ))
              ) : (
                filteredOrders.map((order) => (
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
                  />
                ))
              )}
              
              {!ordersLoading && filteredOrders.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No delivery orders</h3>
                    <p className="text-muted-foreground">
                      {deliveryWindowFilter === 'all' 
                        ? 'No delivery orders found for the selected date'
                        : 'No orders in this time window'
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
        <p className="font-medium">#{order.order_number}</p>
        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
      </div>
      <Badge variant={order.status === 'out_for_delivery' ? 'default' : 'secondary'}>
        {order.status.replace('_', ' ')}
      </Badge>
    </div>
  );
}

function DeliveryOrderCard({ 
  order, 
  onSelect, 
  isSelected,
  schedule
}: { 
  order: any; 
  onSelect?: (selected: boolean) => void;
  isSelected?: boolean;
  schedule?: any;
}) {
  
  return (
    <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {onSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="mt-1"
            />
          )}
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Order #{order.order_number}</h3>
                <p className="text-sm text-muted-foreground">{order.customer_name}</p>
              </div>
              <Badge variant={order.status === 'out_for_delivery' ? 'default' : 'secondary'}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Amount:</span> ₦{order.total_amount}</p>
                <p><span className="text-muted-foreground">Phone:</span> {order.customer_phone}</p>
                {order.assigned_rider_id && (
                  <p><span className="text-muted-foreground">Assigned Driver:</span> 
                    <Badge variant="outline" className="ml-2">Assigned</Badge>
                  </p>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-muted-foreground">Delivery Address:</p>
                <p className="text-xs">{order.delivery_address?.address || 'N/A'}</p>
                {schedule && (
                  <div className="mt-2">
                    <DeliveryScheduleDisplay schedule={schedule} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
