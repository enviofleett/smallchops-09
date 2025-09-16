import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaystackEnvChecker from '@/components/admin/PaystackEnvChecker';
import PaystackIntegrationTestSuite from '@/components/admin/PaystackIntegrationTestSuite';
import ManualE2ETestGuide from '@/components/admin/ManualE2ETestGuide';
import { TestTube, CreditCard, User, Settings } from 'lucide-react';

const PaystackTestingDashboard = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <TestTube className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Paystack Testing Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive testing suite for Paystack integration validation
          </p>
        </div>
      </div>

      <Tabs defaultValue="environment" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="environment" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Environment
          </TabsTrigger>
          <TabsTrigger value="automated" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Automated Tests
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Manual Testing
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="environment" className="space-y-6">
          <PaystackEnvChecker />
        </TabsContent>

        <TabsContent value="automated" className="space-y-6">
          <PaystackIntegrationTestSuite />
        </TabsContent>

        <TabsContent value="manual" className="space-y-6">
          <ManualE2ETestGuide />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Testing Strategy</CardTitle>
                <CardDescription>
                  Our comprehensive approach to validating Paystack integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">1. Environment Validation</h4>
                  <p className="text-sm text-muted-foreground">
                    Verify that PAYSTACK_SECRET_KEY_TEST is accessible and properly configured
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">2. Automated Function Tests</h4>
                  <p className="text-sm text-muted-foreground">
                    Test payment initialization, checkout flow, callbacks, and error handling
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">3. Manual User Journey</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete end-to-end user experience testing from browse to payment completion
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Configuration</CardTitle>
                <CardDescription>
                  Current testing setup and requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Environment Variable</h4>
                  <p className="text-sm text-muted-foreground">
                    PAYSTACK_SECRET_KEY_TEST (set in Supabase Functions)
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Test Card Details</h4>
                  <div className="text-sm text-muted-foreground font-mono">
                    <p>Card: 4084084084084081</p>
                    <p>CVV: 408, Expiry: 12/25, PIN: 0000</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Expected Outcome</h4>
                  <p className="text-sm text-muted-foreground">
                    No "Payment system configuration issue" errors in checkout flow
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaystackTestingDashboard;
