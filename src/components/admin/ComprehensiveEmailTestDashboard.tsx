import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { emailTemplateService, EmailVariables } from '@/services/EmailTemplateService';
import { useEmailDeliveryTracking } from '@/hooks/useEmailDeliveryTracking';
import { WebSocketStabilityMonitor } from './WebSocketStabilityMonitor';
import { EmailSystemStatusOverview } from './EmailSystemStatusOverview';
import { supabase } from '@/integrations/supabase/client';
import { 
  TestTube, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Send,
  ShoppingCart,
  UserPlus,
  Bell,
  CreditCard,
  RefreshCw
} from 'lucide-react';

interface TestResult {
  testName: string;
  status: 'pending' | 'success' | 'error' | 'running';
  message: string;
  timestamp: Date;
  details?: any;
}

export const ComprehensiveEmailTestDashboard = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testEmail, setTestEmail] = useState('test@example.com');
  const { toast } = useToast();
  const { emailStats, deliveryLogs, refetch } = useEmailDeliveryTracking();

  const updateTestResult = (testName: string, status: TestResult['status'], message: string, details?: any) => {
    setTestResults(prev => {
      const existing = prev.findIndex(r => r.testName === testName);
      const newResult: TestResult = { testName, status, message, timestamp: new Date(), details };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResult;
        return updated;
      }
      return [...prev, newResult];
    });
  };

  // Phase 1: Current System Validation
  const testTemplateSystem = async () => {
    updateTestResult('Template System', 'running', 'Testing email templates...');
    
    try {
      // Test template retrieval
      const templates = await emailTemplateService.getAllTemplates();
      if (templates.length === 0) {
        updateTestResult('Template System', 'error', 'No email templates found in database');
        return false;
      }

      // Test template processing
      const orderTemplate = await emailTemplateService.getTemplate('order_confirmation');
      if (!orderTemplate) {
        updateTestResult('Template System', 'error', 'Order confirmation template not found');
        return false;
      }

      const variables: EmailVariables = {
        customer_name: 'Test Customer',
        order_number: 'TEST-001',
        order_total: '₦5,000',
        order_date: new Date().toLocaleDateString(),
        store_name: 'Test Store'
      };

      const processed = emailTemplateService.processTemplate(orderTemplate, variables);
      if (!processed.subject.includes('TEST-001') || !processed.html.includes('Test Customer')) {
        updateTestResult('Template System', 'error', 'Template variable substitution failed');
        return false;
      }

      updateTestResult('Template System', 'success', `Found ${templates.length} templates, variable substitution working`, { templates: templates.length });
      return true;
    } catch (error) {
      updateTestResult('Template System', 'error', `Template system error: ${error.message}`);
      return false;
    }
  };

  const testSMTPConfiguration = async () => {
    updateTestResult('SMTP Config', 'running', 'Testing SMTP configuration...');
    
    try {
      // Use production-safe edge function health check instead of direct database query
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: { healthcheck: true, check: 'smtp' }
      });

      if (error) throw error;

      if (!data?.smtpCheck?.configured) {
        updateTestResult('SMTP Config', 'error', 'SMTP not configured properly');
        return false;
      }

      const source = data.smtpCheck.source === 'function_secrets' ? 'Edge Function Secrets (Production)' : 'Database Configuration (Development)';
      
      updateTestResult('SMTP Config', 'success', `SMTP configuration ready - Source: ${source}`, {
        host: data.smtpCheck.host,
        port: data.smtpCheck.port,
        encryption: data.smtpCheck.encryption,
        source: data.smtpCheck.source,
        production_ready: data.smtpCheck.source === 'function_secrets'
      });
      return true;
    } catch (error) {
      updateTestResult('SMTP Config', 'error', `SMTP config error: ${error.message}`);
      return false;
    }
  };

  const testBasicEmailSending = async () => {
    updateTestResult('Basic Email', 'running', 'Testing basic email sending...');
    
    try {
      const success = await emailTemplateService.sendTemplatedEmail(
        'order_confirmation',
        testEmail,
        {
          customer_name: 'Test User',
          order_number: 'TEST-' + Date.now(),
          order_total: '₦1,000',
          order_date: new Date().toLocaleDateString(),
          store_name: 'Test Store'
        },
        { priority: 'high' }
      );

      if (success) {
        updateTestResult('Basic Email', 'success', `Test email sent to ${testEmail}`);
        return true;
      } else {
        updateTestResult('Basic Email', 'error', 'Email sending failed');
        return false;
      }
    } catch (error) {
      updateTestResult('Basic Email', 'error', `Email sending error: ${error.message}`);
      return false;
    }
  };

  // Phase 2: End-to-End Order Flow Testing
  const testOrderConfirmationFlow = async () => {
    updateTestResult('Order Flow', 'running', 'Testing order confirmation flow...');
    
    try {
      // Create a test order
      const { data: orderData, error: orderError } = await (supabase as any).rpc('create_order_with_items', {
        p_customer_id: 'test-customer-id',
        p_fulfillment_type: 'delivery',
        p_delivery_address: null,
        p_pickup_point_id: null,
        p_delivery_zone_id: null,
        p_guest_session_id: null,
        p_items: JSON.stringify([{
          product_id: '00000000-0000-0000-0000-000000000001', // Assuming a test product exists
          quantity: 1,
          unit_price: 1000
        }])
      });

      const orderResult = orderData as any;
      if (orderError || !orderResult?.success) {
        updateTestResult('Order Flow', 'error', `Order creation failed: ${orderError?.message || 'Unknown error'}`);
        return false;
      }

      // Check if communication event was created
      const { data: commEvents, error: commError } = await (supabase as any)
        .from('communication_events')
        .select('*')
        .eq('order_id', orderResult.order_id)
        .eq('event_type', 'order_confirmation');

      if (commError || !commEvents || commEvents.length === 0) {
        updateTestResult('Order Flow', 'error', 'No order confirmation event created');
        return false;
      }

      updateTestResult('Order Flow', 'success', `Order created with ID: ${orderResult.order_id}, confirmation event queued`, {
        orderId: orderResult.order_id,
        orderNumber: orderResult.order_number
      });
      return true;
    } catch (error) {
      updateTestResult('Order Flow', 'error', `Order flow error: ${error.message}`);
      return false;
    }
  };

  // Phase 3: Complete Email Type Coverage Testing
  const testWelcomeEmail = async () => {
    updateTestResult('Welcome Email', 'running', 'Testing welcome email...');
    
    try {
      const success = await emailTemplateService.sendTemplatedEmail(
        'customer_welcome',
        testEmail,
        {
          customer_name: 'New Customer',
          store_name: 'Test Store',
          support_email: 'support@teststore.com'
        },
        { priority: 'normal' }
      );

      if (success) {
        updateTestResult('Welcome Email', 'success', 'Welcome email sent successfully');
        return true;
      } else {
        updateTestResult('Welcome Email', 'error', 'Welcome email sending failed');
        return false;
      }
    } catch (error) {
      updateTestResult('Welcome Email', 'error', `Welcome email error: ${error.message}`);
      return false;
    }
  };

  const testPasswordResetEmail = async () => {
    updateTestResult('Password Reset', 'running', 'Testing password reset email...');
    
    try {
      // Check if password reset template exists
      const template = await emailTemplateService.getTemplate('password_reset');
      if (!template) {
        updateTestResult('Password Reset', 'error', 'Password reset template not found');
        return false;
      }

      const success = await emailTemplateService.sendTemplatedEmail(
        'password_reset',
        testEmail,
        {
          customer_name: 'Test User',
          reset_link: 'https://example.com/reset?token=test123',
          store_name: 'Test Store'
        }
      );

      if (success) {
        updateTestResult('Password Reset', 'success', 'Password reset email sent');
        return true;
      } else {
        updateTestResult('Password Reset', 'error', 'Password reset email failed');
        return false;
      }
    } catch (error) {
      updateTestResult('Password Reset', 'error', `Password reset error: ${error.message}`);
      return false;
    }
  };

  // Phase 4: Production Robustness Testing
  const testEmailDeliveryTracking = async () => {
    updateTestResult('Delivery Tracking', 'running', 'Testing email delivery tracking...');
    
    try {
      // Refresh delivery logs
      await refetch();
      
      if (deliveryLogs.length === 0) {
        updateTestResult('Delivery Tracking', 'error', 'No delivery logs found');
        return false;
      }

      const recentLogs = deliveryLogs.filter(log => 
        new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

      updateTestResult('Delivery Tracking', 'success', `Found ${recentLogs.length} recent delivery logs`, {
        totalLogs: deliveryLogs.length,
        recentLogs: recentLogs.length,
        stats: emailStats
      });
      return true;
    } catch (error) {
      updateTestResult('Delivery Tracking', 'error', `Delivery tracking error: ${error.message}`);
      return false;
    }
  };

  const testEmailQueueManagement = async () => {
    updateTestResult('Queue Management', 'running', 'Testing email queue management...');
    
    try {
      const { data: queuedEmails, error } = await (supabase as any)
        .from('communication_events')
        .select('*')
        .eq('status', 'queued')
        .limit(10);

      if (error) {
        updateTestResult('Queue Management', 'error', `Queue query error: ${error.message}`);
        return false;
      }

      // Test processing queue
      const { data: processResult, error: processError } = await supabase.functions.invoke('instant-email-processor');
      
      if (processError) {
        updateTestResult('Queue Management', 'error', `Queue processing error: ${processError.message}`);
        return false;
      }

      updateTestResult('Queue Management', 'success', `Found ${queuedEmails?.length || 0} queued emails, processing successful`, {
        queuedCount: queuedEmails?.length || 0,
        processResult
      });
      return true;
    } catch (error) {
      updateTestResult('Queue Management', 'error', `Queue management error: ${error.message}`);
      return false;
    }
  };

  // Run all tests sequentially
  const runAllTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    
    try {
      // Phase 1: Current System Validation
      await testTemplateSystem();
      await testSMTPConfiguration();
      await testBasicEmailSending();
      
      // Phase 2: End-to-End Flow
      await testOrderConfirmationFlow();
      
      // Phase 3: Email Type Coverage
      await testWelcomeEmail();
      await testPasswordResetEmail();
      
      // Phase 4: Production Robustness
      await testEmailDeliveryTracking();
      await testEmailQueueManagement();
      
      toast({
        title: 'Testing Complete',
        description: 'All email system tests completed',
      });
    } catch (error) {
      toast({
        title: 'Testing Error',
        description: `Error during testing: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const successCount = testResults.filter(r => r.status === 'success').length;
  const errorCount = testResults.filter(r => r.status === 'error').length;
  const totalTests = testResults.length;

  return (
    <div className="space-y-6">
      <EmailSystemStatusOverview />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Comprehensive Email System Testing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Test email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={runAllTests}
                disabled={isRunningTests || !testEmail}
                className="flex items-center gap-2"
              >
                {isRunningTests ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
              </Button>
            </div>

            {totalTests > 0 && (
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {successCount} Passed
                </Badge>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {errorCount} Failed
                </Badge>
                <Badge variant="secondary">
                  {totalTests} Total
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium">{result.testName}</div>
                      <div className="text-sm text-muted-foreground">{result.message}</div>
                      {result.details && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(result.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(result.status)}>
                      {result.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {result.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="individual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="individual">Individual Tests</TabsTrigger>
          <TabsTrigger value="stats">Email Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <WebSocketStabilityMonitor />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" onClick={testTemplateSystem} disabled={isRunningTests}>
              <Mail className="h-4 w-4 mr-2" />
              Test Templates
            </Button>
            <Button variant="outline" onClick={testSMTPConfiguration} disabled={isRunningTests}>
              <Send className="h-4 w-4 mr-2" />
              Test SMTP
            </Button>
            <Button variant="outline" onClick={testOrderConfirmationFlow} disabled={isRunningTests}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Test Order Flow
            </Button>
            <Button variant="outline" onClick={testWelcomeEmail} disabled={isRunningTests}>
              <UserPlus className="h-4 w-4 mr-2" />
              Test Welcome
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{emailStats.total_sent}</div>
                    <div className="text-sm text-muted-foreground">Total Sent</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{emailStats.delivered}</div>
                    <div className="text-sm text-muted-foreground">Delivered</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold">{emailStats.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold">{emailStats.delivery_rate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Delivery Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};