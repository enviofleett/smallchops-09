import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailManagementDashboard } from './EmailManagementDashboard';
import { EmailDeliveryDashboard } from '@/components/settings/EmailDeliveryDashboard';

export const EmailSettingsPage = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Email Settings</h1>
        <p className="text-muted-foreground">
          Manage your email configuration, templates, and monitor delivery status
        </p>
      </div>

      <EmailManagementDashboard />

      <Card>
        <CardHeader>
          <CardTitle>Recent Email Deliveries</CardTitle>
          <CardDescription>
            Monitor the latest email delivery attempts and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailDeliveryDashboard />
        </CardContent>
      </Card>
    </div>
  );
};