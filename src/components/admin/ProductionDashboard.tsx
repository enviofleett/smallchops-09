import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductionReadinessMonitor } from '@/components/admin/ProductionReadinessMonitor';
import { RealTimeEmailProcessor } from '@/components/settings/RealTimeEmailProcessor';
import { EmailDeliveryMonitor } from '@/components/settings/EmailDeliveryMonitor';
import { EmailProcessingTab } from '@/components/settings/EmailProcessingTab';
import { EmailHealthDashboard } from '@/components/admin/EmailHealthDashboard';
import { Shield, Zap, BarChart3, Settings } from 'lucide-react';

export const ProductionDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Production Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and optimize your production systems for 100% reliability
        </p>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Health Monitor
          </TabsTrigger>
          <TabsTrigger value="processing" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Email Processing
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          <ProductionReadinessMonitor />
        </TabsContent>

        <TabsContent value="processing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Real-Time Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <RealTimeEmailProcessor />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Email Queue Management</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailProcessingTab />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <EmailHealthDashboard />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Production Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Automated Email Processing</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Emails are automatically processed every minute for immediate delivery.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Function: automated-email-cron (runs every 60 seconds)
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Health Monitoring</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    System health is continuously monitored with auto-recovery triggers.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Function: email-production-monitor (triggered on health issues)
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Rate Limiting</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Smart rate limiting protects against spam and ensures delivery quality.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Transactional: 500/hour, Marketing: 100/hour per domain
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};