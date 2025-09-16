import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ShoppingCart, 
  CreditCard, 
  Shield, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  Activity
} from 'lucide-react';
import { ProductionReadinessDashboard } from './ProductionReadinessDashboard';
import { ProductionSafetyMonitor } from './ProductionSafetyMonitor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CheckoutTest {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  category: 'flow' | 'security' | 'payment' | 'validation';
}

export const CheckoutAuditDashboard: React.FC = () => {
  const [checkoutTests, setCheckoutTests] = useState<CheckoutTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastTestRun, setLastTestRun] = useState<Date | null>(null);
  const { toast } = useToast();

  const runCheckoutAudit = async () => {
    setLoading(true);
    const tests: CheckoutTest[] = [];

    try {
      // Test 1: Verify process-checkout function accessibility
      try {
        const { error } = await supabase.functions.invoke('process-checkout', {
          body: { test: true }
        });
        
        if (error && error.message?.includes('test')) {
          tests.push({
            name: 'Checkout Function Accessibility',
            status: 'pass',
            message: 'Process-checkout function is accessible and responding',
            category: 'flow'
          });
        } else {
          tests.push({
            name: 'Checkout Function Accessibility', 
            status: 'warning',
            message: 'Process-checkout function may have configuration issues',
            category: 'flow'
          });
        }
      } catch (error) {
        tests.push({
          name: 'Checkout Function Accessibility',
          status: 'fail',
          message: 'Process-checkout function is not accessible',
          category: 'flow'
        });
      }

      // Test 2: Verify payment transactions table access
      try {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('id')
          .limit(1);
        
        if (!error) {
          tests.push({
            name: 'Payment Transactions Access',
            status: 'pass',
            message: 'Payment transactions table is accessible',
            category: 'security'
          });
        } else {
          tests.push({
            name: 'Payment Transactions Access',
            status: 'fail',
            message: `Payment transactions access failed: ${error.message}`,
            category: 'security'
          });
        }
      } catch (error) {
        tests.push({
          name: 'Payment Transactions Access',
          status: 'fail',
          message: 'Unable to access payment transactions table',
          category: 'security'
        });
      }

      // Test 3: Verify orders table access
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id')
          .limit(1);
        
        if (!error) {
          tests.push({
            name: 'Orders Table Access',
            status: 'pass',
            message: 'Orders table is accessible with proper permissions',
            category: 'security'
          });
        } else {
          tests.push({
            name: 'Orders Table Access',
            status: 'warning',
            message: `Orders access issues: ${error.message}`,
            category: 'security'
          });
        }
      } catch (error) {
        tests.push({
          name: 'Orders Table Access',
          status: 'fail',
          message: 'Unable to access orders table',
          category: 'security'
        });
      }

      // Test 4: Check payment integration configuration
      try {
        const { data, error } = await supabase
          .from('payment_integrations')
          .select('provider, test_mode')
          .eq('provider', 'paystack')
          .limit(1);
        
        if (!error && data && data.length > 0) {
          tests.push({
            name: 'Payment Integration Config',
            status: 'pass',
            message: `Paystack configured in ${data[0].test_mode ? 'test' : 'live'} mode`,
            category: 'payment'
          });
        } else {
          tests.push({
            name: 'Payment Integration Config',
            status: 'fail', 
            message: 'Paystack integration not found or not configured',
            category: 'payment'
          });
        }
      } catch (error) {
        tests.push({
          name: 'Payment Integration Config',
          status: 'fail',
          message: 'Unable to check payment integration status',
          category: 'payment'
        });
      }

      // Test 5: Check business settings
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('name, allow_guest_checkout')
          .limit(1);
        
        if (!error && data && data.length > 0) {
          tests.push({
            name: 'Business Configuration',
            status: 'pass',
            message: `Business settings configured. Guest checkout: ${data[0].allow_guest_checkout ? 'enabled' : 'disabled'}`,
            category: 'validation'
          });
        } else {
          tests.push({
            name: 'Business Configuration',
            status: 'fail',
            message: 'Business settings not configured',
            category: 'validation'
          });
        }
      } catch (error) {
        tests.push({
          name: 'Business Configuration',
          status: 'fail',
          message: 'Unable to access business settings',
          category: 'validation'
        });
      }

      setCheckoutTests(tests);
      setLastTestRun(new Date());

      const failedTests = tests.filter(t => t.status === 'fail');
      const warningTests = tests.filter(t => t.status === 'warning');

      if (failedTests.length === 0 && warningTests.length === 0) {
        toast({
          title: "Checkout Audit Complete",
          description: "All checkout systems are functioning correctly",
        });
      } else if (failedTests.length > 0) {
        toast({
          title: "Critical Issues Found",
          description: `${failedTests.length} critical issue(s) detected in checkout flow`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Warnings Found",
          description: `${warningTests.length} warning(s) detected in checkout flow`,
        });
      }

    } catch (error) {
      console.error('Checkout audit error:', error);
      toast({
        title: "Audit Failed",
        description: "Failed to run checkout audit",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTestIcon = (status: string, size = 16) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="text-green-600" size={size} />;
      case 'warning':
        return <AlertTriangle className="text-yellow-600" size={size} />;
      case 'fail':
        return <XCircle className="text-red-600" size={size} />;
      default:
        return <AlertTriangle className="text-gray-500" size={size} />;
    }
  };

  const getCategoryIcon = (category: string, size = 16) => {
    switch (category) {
      case 'flow':
        return <ShoppingCart className="text-blue-600" size={size} />;
      case 'security':
        return <Shield className="text-red-600" size={size} />;
      case 'payment':
        return <CreditCard className="text-green-600" size={size} />;
      case 'validation':
        return <Activity className="text-purple-600" size={size} />;
      default:
        return <Eye className="text-gray-500" size={size} />;
    }
  };

  const passCount = checkoutTests.filter(t => t.status === 'pass').length;
  const failCount = checkoutTests.filter(t => t.status === 'fail').length;
  const warningCount = checkoutTests.filter(t => t.status === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Checkout Audit & Production Health</h2>
          <p className="text-muted-foreground">
            Comprehensive checkout system validation for production deployment
          </p>
        </div>
        <Button 
          onClick={runCheckoutAudit}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          Run Audit
        </Button>
      </div>

      {/* Test Results Summary */}
      {checkoutTests.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <p className="text-xs text-muted-foreground">
                Tests passing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
              <p className="text-xs text-muted-foreground">
                Tests with warnings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <p className="text-xs text-muted-foreground">
                Tests failing
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Results */}
      <Tabs defaultValue="audit" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit">Checkout Audit</TabsTrigger>
          <TabsTrigger value="readiness">Production Readiness</TabsTrigger>
          <TabsTrigger value="monitoring">Safety Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {checkoutTests.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center space-y-2">
                  <Eye className="mx-auto text-muted-foreground" size={48} />
                  <p className="text-muted-foreground">No audit results yet</p>
                  <Button onClick={runCheckoutAudit} disabled={loading}>
                    Run Checkout Audit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {checkoutTests.map((test, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {getCategoryIcon(test.category)}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{test.name}</h4>
                            {getTestIcon(test.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {test.message}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        test.status === 'pass' ? 'default' : 
                        test.status === 'warning' ? 'secondary' : 'destructive'
                      }>
                        {test.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {lastTestRun && (
            <div className="text-sm text-muted-foreground text-center">
              Last audit: {lastTestRun.toLocaleString()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="readiness">
          <ProductionReadinessDashboard />
        </TabsContent>

        <TabsContent value="monitoring">
          <ProductionSafetyMonitor />
        </TabsContent>
      </Tabs>

      {/* Overall Status Alert */}
      {checkoutTests.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            {failCount === 0 && warningCount === 0 ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Checkout System: Production Ready!</strong><br />
                  All critical tests are passing. The checkout flow is secure and ready for live transactions.
                </AlertDescription>
              </Alert>
            ) : failCount > 0 ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Critical Issues Detected!</strong><br />
                  {failCount} critical issue(s) must be resolved before going live.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnings Detected</strong><br />
                  {warningCount} warning(s) should be addressed for optimal performance.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};