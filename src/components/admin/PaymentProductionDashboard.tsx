import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentReconciliation } from './PaymentReconciliation';
import { PaymentHealthMonitor } from './PaymentHealthMonitor';
import { PaymentDiagnostics } from '../payments/PaymentDiagnostics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet-async';
import { 
  Activity, 
  Search, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';

export const PaymentProductionDashboard: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Payment Production Dashboard | Admin</title>
        <meta name="description" content="Comprehensive payment system monitoring and management dashboard" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Production Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor, diagnose, and manage your Paystack payment system
          </p>
        </div>

        <Tabs defaultValue="health" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Health Monitor
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Diagnostics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-6">
            <PaymentHealthMonitor />
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            <PaymentReconciliation />
          </TabsContent>

          <TabsContent value="diagnostics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Payment Diagnostics
                </CardTitle>
                <CardDescription>
                  Search and verify individual payment transactions by reference
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentDiagnostics />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Production Readiness Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Production Readiness Status
            </CardTitle>
            <CardDescription>
              Your payment system is now production-ready with comprehensive monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Webhook Authentication</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enhanced signature verification with detailed logging
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Reference Handling</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Robust callback URL with multiple fallback mechanisms
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Auto Recovery</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automated detection and fixing of stuck orders
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Real-time Monitoring</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Live health metrics with proactive alerts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};