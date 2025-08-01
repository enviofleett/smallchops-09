
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Users, MapPin, BarChart3, Route, Calendar } from "lucide-react";
import { DriverManagement } from "@/components/delivery/DriverManagement";
import { DeliveryTracker } from "@/components/delivery/DeliveryTracker";

export default function DeliveryPickupPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="w-full min-h-[calc(100vh-110px)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Delivery & Pickup Management</h1>
            <p className="text-muted-foreground">Manage drivers, routes, and track deliveries</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="grid w-full min-w-[600px] grid-cols-6 md:min-w-0">
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
              <TabsTrigger value="routes" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Route className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Routes</span>
                <span className="sm:hidden">Route</span>
              </TabsTrigger>
              <TabsTrigger value="tracking" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Truck className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Tracking</span>
                <span className="sm:hidden">Track</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Schedule</span>
                <span className="sm:hidden">Sched</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Active Drivers</CardTitle>
                  <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">drivers available</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Active Routes</CardTitle>
                  <Route className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">routes in progress</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Pending Deliveries</CardTitle>
                  <Truck className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">orders to deliver</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Delivery Zones</CardTitle>
                  <MapPin className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">zones configured</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Today's Delivery Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No delivery data available yet. Start by adding drivers and creating delivery zones.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drivers">
            <DriverManagement />
          </TabsContent>

          <TabsContent value="zones">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Zones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Delivery zones management will be implemented here.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes">
            <Card>
              <CardHeader>
                <CardTitle>Route Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Route planning and optimization will be implemented here.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracking">
            <DeliveryTracker />
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
    </div>
  );
}
