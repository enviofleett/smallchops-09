import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentDebugger } from '@/components/admin/PaymentDebugger';
import { PaymentSystemValidator } from '@/components/checkout/PaymentSystemValidator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System diagnostics and monitoring tools</p>
      </div>
      
      <Tabs defaultValue="payment-diagnostics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="payment-diagnostics">Payment Diagnostics</TabsTrigger>
          <TabsTrigger value="system-health">System Health</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payment-diagnostics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Debugger</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentDebugger />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Payment System Validator</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentSystemValidator />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="system-health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Health Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Additional system health tools will be added here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};