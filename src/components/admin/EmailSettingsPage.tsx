import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailManagementDashboard } from './EmailManagementDashboard';
import { EmailDeliveryDashboard } from '@/components/settings/EmailDeliveryDashboard';
import { EmailTemplateManager } from './EmailTemplateManager';

export const EmailSettingsPage = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Email Settings</h1>
        <p className="text-muted-foreground">
          Manage your email configuration, templates, and monitor delivery status
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EmailManagementDashboard />
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplateManager />
        </TabsContent>

        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>Email Delivery Monitoring</CardTitle>
              <CardDescription>
                Monitor the latest email delivery attempts and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailDeliveryDashboard />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};