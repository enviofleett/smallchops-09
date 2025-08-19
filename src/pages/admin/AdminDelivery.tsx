import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import {
  Card, CardContent, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Button, Badge, Checkbox,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui';
import { Calendar } from '@/components/ui/calendar';
import { MapPin, Package, Truck, Clock, Users, CalendarIcon, AlertTriangle } from 'lucide-react';

import { getOrders } from '@/api/orders';
import { getSchedulesByOrderIds } from '@/api/deliveryScheduleApi';
import { useDeliveryZones } from '@/hooks/useDeliveryTracking';

import { SystemStatusChecker } from '@/components/admin/SystemStatusChecker';
import { ShippingFeesReport } from '@/components/admin/delivery/ShippingFeesReport';
import { DriverAssignDialog } from '@/components/admin/delivery/DriverAssignDialog';
import { DriverDialog } from '@/components/delivery/DriverDialog';
import { AdminDriversTab } from '@/components/admin/delivery/AdminDriversTab';
import { DeliveryZonesManager } from '@/components/delivery/DeliveryZonesManager';
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { formatAddress } from '@/utils/formatAddress';
import { cn } from '@/lib/utils';

// ---------- Types ----------
interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  order_type: string;
  payment_status: string;
  status: string;
  assigned_rider_id?: string;
  delivery_address?: any;
  special_instructions?: string;
  items?: { special_instructions?: string }[];
  total_amount?: number;
  delivery_fee?: number;
}

interface DeliverySchedule {
  delivery_time_start: string;
  delivery_time_end: string;
  special_instructions?: string;
}

// ---------- Helpers ----------
const getDeliveryWindows = () => {
  const windows = ['all'];
  for (let hour = 8; hour <= 20; hour++) {
    windows.push(`${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`);
  }
  windows.push('due-now');
  return windows;
};

// ---------- Main Component ----------
export default function AdminDelivery() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);
  const [deliveryWindowFilter, setDeliveryWindowFilter] = useState<string>('all');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedDateToday = isToday(selectedDate);

  // Fetch orders
  const { data: deliveryOrdersData, isLoading: ordersLoading, error: ordersError, refetch } = useQuery({
    queryKey: ['delivery-orders', selectedDateString],
    queryFn: () =>
      getOrders({
        page: 1,
        pageSize: 1000,
        startDate: selectedDateString,
        endDate: selectedDateString,
      }),
    refetchInterval: isSelectedDateToday ? 30000 : undefined,
  });

  const deliveryOrders: Order[] =
    deliveryOrdersData?.orders?.filter(
      (o: Order) =>
        o.order_type === 'delivery' &&
        o.payment_status === 'paid' &&
        ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)
    ) || [];

  const readyOrders = deliveryOrders.filter((o) => o.status === 'ready');
  const readyOrderIds = readyOrders.map((o) => o.id);

  const { data: deliverySchedules = {}, error: schedulesError } = useQuery<Record<string, DeliverySchedule>>({
    queryKey: ['delivery-schedules-bulk', readyOrderIds],
    queryFn: () => getSchedulesByOrderIds(readyOrderIds),
    enabled: readyOrderIds.length > 0,
  });

  const { zones } = useDeliveryZones();

  // Windows
  const deliveryWindows = useMemo(getDeliveryWindows, []);

  const readyFilteredOrders = useMemo(() => {
    if (deliveryWindowFilter === 'all') return readyOrders;
    if (deliveryWindowFilter === 'due-now') {
      const now = new Date();
      const current = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes()
        .toString()
        .padStart(2, '0')}`;
      return readyOrders.filter((o) => {
        const schedule = deliverySchedules[o.id];
        return schedule && current >= schedule.delivery_time_start && current <= schedule.delivery_time_end;
      });
    }
    const [startHour] = deliveryWindowFilter.split('-');
    return readyOrders.filter((o) => {
      const schedule = deliverySchedules[o.id];
      return schedule?.delivery_time_start.startsWith(startHour);
    });
  }, [readyOrders, deliveryWindowFilter, deliverySchedules]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedOrders((prev) => prev.filter((o) => readyFilteredOrders.some((f) => f.id === o.id)));
  }, [readyFilteredOrders]);

  const deliveryMetrics = {
    total: deliveryOrders.length,
    inProgress: deliveryOrders.filter((o) => ['preparing', 'ready'].includes(o.status)).length,
    outForDelivery: deliveryOrders.filter((o) => o.status === 'out_for_delivery').length,
    assigned: deliveryOrders.filter((o) => o.assigned_rider_id).length,
  };

  const handleSelectOrder = useCallback(
    (order: Order, selected: boolean) => {
      setSelectedOrders((prev) =>
        selected ? [...prev, order] : prev.filter((o) => o.id !== order.id)
      );
    },
    []
  );

  return (
    <>
      <Helmet>
        <title>Delivery Management - Admin Dashboard</title>
      </Helmet>

      <div className="space-y-6 p-6">
        <SystemStatusChecker />

        {/* Header */}
        <Header selectedDate={selectedDate} setSelectedDate={setSelectedDate} isCalendarOpen={isCalendarOpen} setIsCalendarOpen={setIsCalendarOpen} />

        {/* Errors */}
        {ordersError && <ErrorBanner message={ordersError instanceof Error ? ordersError.message : 'Unknown error'} />}
        {deliveryOrdersData?.count === 1000 && <WarningBanner />}

        {/* Metrics */}
        <MetricsGrid metrics={deliveryMetrics} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="zones">Zones</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Recent Orders + Shipping Fees */}
          </TabsContent>

          <TabsContent value="orders">
            <OrderList
              readyFilteredOrders={readyFilteredOrders}
              schedules={deliverySchedules}
              selectedOrders={selectedOrders}
              onSelect={handleSelectOrder}
              onAssignDriver={(order) => {
                setSelectedOrders([order]);
                setIsDriverDialogOpen(true);
              }}
              deliveryWindowFilter={deliveryWindowFilter}
              setDeliveryWindowFilter={setDeliveryWindowFilter}
              deliveryWindows={deliveryWindows}
              ordersLoading={ordersLoading}
              schedulesError={schedulesError}
            />
          </TabsContent>

          <TabsContent value="drivers">
            <AdminDriversTab />
          </TabsContent>

          <TabsContent value="zones">
            <DeliveryZonesManager />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <DriverDialog open={isRegisterDriverOpen} onOpenChange={setIsRegisterDriverOpen} onSave={() => setIsRegisterDriverOpen(false)} />
        <DriverAssignDialog
          isOpen={isDriverDialogOpen}
          onClose={() => setIsDriverDialogOpen(false)}
          selectedOrders={selectedOrders}
          onSuccess={() => {
            setSelectedOrders([]);
            setIsDriverDialogOpen(false);
            refetch();
          }}
        />
      </div>
    </>
  );
}

// ---------- Smaller Components (simplified) ----------
function Header({ selectedDate, setSelectedDate, isCalendarOpen, setIsCalendarOpen }: any) {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold">Delivery Management</h1>
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(selectedDate, 'PPP')}
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded p-4 flex gap-2">
      <AlertTriangle className="text-destructive w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}

function WarningBanner() {
  return (
    <div className="bg-orange-500/10 border border-orange-500/20 rounded p-4 flex gap-2">
      <AlertTriangle className="text-orange-600 w-4 h-4" />
      <span>Maximum data limit reached (1000 orders). Narrow your date range.</span>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard label="Total" value={metrics.total} icon={Package} />
      <MetricCard label="In Progress" value={metrics.inProgress} icon={Clock} color="orange" />
      <MetricCard label="Out for Delivery" value={metrics.outForDelivery} icon={Truck} color="purple" />
      <MetricCard label="Assigned" value={metrics.assigned} icon={Users} color="green" />
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color = 'primary' }: any) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`p-2 rounded bg-${color}-500/10 text-${color}-600`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
