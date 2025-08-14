import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeliveryScheduleDashboard } from '@/components/admin/delivery/DeliveryScheduleDashboard';
import { DriverManagement } from '@/components/delivery/DriverManagement';
import { OrderAssignment } from '@/components/admin/OrderAssignment';
import { DeliveryReports } from '@/components/delivery/DeliveryReports';

export default function AdminDelivery() {
  return (
    <>
      <Helmet>
        <title>Delivery Management</title>
        <meta name="description" content="Manage delivery operations, drivers, and order assignments." />
      </Helmet>

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Management</h1>
          <p className="text-muted-foreground">
            Manage delivery operations, drivers, and performance metrics.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignment">Order Assignment</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <DeliveryScheduleDashboard />
          </TabsContent>

          <TabsContent value="assignment" className="space-y-4">
            <OrderAssignment />
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4">
            <DriverManagement />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <DeliveryReports />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
