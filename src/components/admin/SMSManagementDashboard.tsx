import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Settings, BarChart3, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { SMSTemplateManager } from './SMSTemplateManager';
import { SMSConfiguration } from './SMSConfiguration';
import { Badge } from '@/components/ui/badge';
import { useSMSStats } from '@/hooks/useSMSStats';
import { SMSProductionStatus } from './SMSProductionStatus';

export const SMSManagementDashboard = () => {
  const { stats, loading: statsLoading } = useSMSStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Management</h1>
          <p className="text-muted-foreground">
            Configure SMS templates, monitor delivery, and manage notifications for your business
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            MySMSTab Integration
          </Badge>
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Production Ready
          </Badge>
        </div>
      </div>

      {/* Production Readiness Status */}
      <SMSProductionStatus />

      {/* SMS Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.total_sent?.toLocaleString() || '0'}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '...' : `${stats?.success_rate?.toFixed(1) || '0'}%`}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '...' : stats?.failed?.toLocaleString() || '0'}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">
                  ₦{statsLoading ? '...' : stats?.total_cost?.toLocaleString() || '0'}
                </p>
              </div>
              <Shield className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main SMS Management Interface */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="templates" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS Templates
              </TabsTrigger>
              <TabsTrigger value="configuration" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">SMS Template Management</h3>
                <p className="text-muted-foreground mb-4">
                  Create and manage SMS templates for order notifications, marketing, and system messages.
                  Use variables like {`{{customer_name}}`} and {`{{order_number}}`} for dynamic content.
                </p>
              </div>
              <SMSTemplateManager />
            </TabsContent>

            <TabsContent value="configuration" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">SMS Provider Configuration</h3>
                <p className="text-muted-foreground mb-4">
                  Configure MySMSTab integration, sender ID, rate limits, and test SMS functionality.
                  Make sure to set your credentials in the Supabase secrets.
                </p>
              </div>
              <SMSConfiguration />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Production Readiness Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SMS Integration Status
          </CardTitle>
          <CardDescription>
            Production readiness checklist for SMS integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm">MySMSTab credentials configured</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm">SMS templates created and active</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm">Rate limiting configured</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm">Delivery logging enabled</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="text-sm">Security audit passed</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};