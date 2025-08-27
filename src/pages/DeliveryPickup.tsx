import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, BarChart3, Route, TrendingUp } from "lucide-react";
import { DriverManagement } from "@/components/delivery/DriverManagement";
import { DeliveryZonesManager } from "@/components/delivery/DeliveryZonesManager";
import { DeliveryDashboard } from "@/components/delivery/DeliveryDashboard";
import { DeliveryAnalytics } from "@/components/delivery/DeliveryAnalytics";
import { DeliveryRoutes } from "@/components/delivery/DeliveryRoutes";

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
            <TabsList className="grid w-full min-w-[500px] grid-cols-5 md:min-w-0">
              <TabsTrigger value="overview" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">All Orders</span>
                <span className="sm:hidden">Orders</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="routes" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Route className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Routes</span>
                <span className="sm:hidden">Routes</span>
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
            <DeliveryDashboard />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <DeliveryAnalytics />
          </TabsContent>

          <TabsContent value="routes" className="space-y-6">
            <DeliveryRoutes />
          </TabsContent>

          <TabsContent value="drivers">
            <DriverManagement />
          </TabsContent>

          <TabsContent value="zones">
            <DeliveryZonesManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}