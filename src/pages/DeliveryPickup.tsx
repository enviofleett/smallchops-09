import React, { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, BarChart3, Calendar } from "lucide-react";
import { DriverManagement } from "@/components/delivery/DriverManagement";
import { DeliveryZonesManager } from "@/components/delivery/DeliveryZonesManager";
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
export default function DeliveryPickupPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch recent delivery orders
  const { data: ordersData } = useQuery({
    queryKey: ['recent-delivery-orders'],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 10,
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get order IDs for schedule fetching
  const orderIds = useMemo(() => 
    ordersData?.orders?.filter(order => order.order_type === 'delivery').map(order => order.id) || [],
    [ordersData]
  );

  // Fetch delivery schedules for orders that might be missing them
  const { schedules } = useOrderDeliverySchedules(orderIds);

  // Calculate updated metrics with live data
  const deliveryMetrics = useMemo(() => {
    const deliveryOrders = ordersData?.orders?.filter(order => 
      order.order_type === 'delivery' && order.payment_status === 'paid'
    ) || [];

    return {
      activeDrivers: 0, // This would need to come from drivers API
      pendingDeliveries: deliveryOrders.filter(order => 
        ['confirmed', 'preparing', 'ready'].includes(order.status)
      ).length,
      deliveryZones: 0, // This would need to come from zones API
    };
  }, [ordersData]);

  return <div className="w-full min-h-[calc(100vh-110px)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Delivery & Pickup Management</h1>
            <p className="text-muted-foreground">Manage drivers, routes, and track deliveries</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="grid w-full min-w-[480px] grid-cols-4 md:min-w-0">
              <TabsTrigger value="overview" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Over</span>
              </TabsTrigger>
              <TabsTrigger value="drivers" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Drivers</span>
                <span className="sm:hidden">Drive</span>
              </TabsTrigger>
              <TabsTrigger value="zones" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Zones</span>
                <span className="sm:hidden">Zone</span>
              </TabsTrigger>
              
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Active Drivers</CardTitle>
                  <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">{deliveryMetrics.activeDrivers}</div>
                  <p className="text-xs text-muted-foreground">drivers available</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Pending Deliveries</CardTitle>
                  <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">{deliveryMetrics.pendingDeliveries}</div>
                  <p className="text-xs text-muted-foreground">orders to deliver</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Delivery Zones</CardTitle>
                  <MapPin className="h-3 w-3 md:w-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">{deliveryMetrics.deliveryZones}</div>
                  <p className="text-xs text-muted-foreground">zones configured</p>
                </CardContent>
              </Card>

            </div>

            <Card>
              <CardHeader>
                <CardTitle>Today's Delivery Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ordersData?.orders?.filter(order => 
                    order.order_type === 'delivery' && order.payment_status === 'paid'
                  ).slice(0, 5).map((order) => {
                    const schedule = order.delivery_schedule || schedules[order.id];
                    return (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          {schedule && (
                            <p className="text-xs text-blue-600">
                              {schedule.delivery_date} • {schedule.delivery_time_start}-{schedule.delivery_time_end}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">₦{order.total_amount?.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground capitalize">{order.status.replace('_', ' ')}</div>
                        </div>
                      </div>
                    );
                  }) || (
                    <div className="text-center py-8 text-muted-foreground">
                      No delivery data available yet. Start by adding drivers and creating delivery zones.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <DriverManagement />
          </TabsContent>

          <TabsContent value="zones">
            <DeliveryZonesManager />
          </TabsContent>


          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Delivery scheduling will be implemented here.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}