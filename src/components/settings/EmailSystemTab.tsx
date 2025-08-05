import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SMTPSettingsTab } from './SMTPSettingsTab';
import { EmailSystemMonitor } from '../admin/EmailSystemMonitor';
import { ProductionEmailDashboard } from './ProductionEmailDashboard';
import { EnhancedEmailProcessor } from '../admin/EnhancedEmailProcessor';
import { EmailTemplateManager } from '../admin/EmailTemplateManager';
import { EmailDeliveryDashboard } from '../admin/EmailDeliveryDashboard';
import { ComprehensiveEmailTestDashboard } from '../admin/ComprehensiveEmailTestDashboard';

export const EmailSystemTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email System Management</h2>
        <p className="text-muted-foreground">
          Configure and monitor your email delivery system
        </p>
      </div>

      <Tabs defaultValue="testing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="enhanced">Processing</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="dashboard">Production</TabsTrigger>
        </TabsList>

        <TabsContent value="testing" className="space-y-6">
          <ComprehensiveEmailTestDashboard />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <EmailTemplateManager />
        </TabsContent>

        <TabsContent value="delivery" className="space-y-6">
          <EmailDeliveryDashboard />
        </TabsContent>

        <TabsContent value="enhanced" className="space-y-6">
          <EnhancedEmailProcessor />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-6">
          <EmailSystemMonitor />
        </TabsContent>

        <TabsContent value="smtp" className="space-y-6">
          <SMTPSettingsTab />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <ProductionEmailDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};