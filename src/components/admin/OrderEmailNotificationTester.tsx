import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  Send, 
  RefreshCw,
  AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sendOrderStatusNotification } from '@/api/notifications';

interface TestResult {
  status: string;
  success: boolean;
  message: string;
  templateKey: string;
  timestamp: string;
}

const ORDER_STATUSES = [
  { value: 'confirmed', label: 'Order Confirmed', templateKey: 'order_confirmation' },
  { value: 'preparing', label: 'Order Preparing', templateKey: 'order_processing' },
  { value: 'ready', label: 'Order Ready', templateKey: 'order_ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery', templateKey: 'out_for_delivery' },
  { value: 'delivered', label: 'Order Delivered', templateKey: 'order_completed' },
  { value: 'completed', label: 'Order Completed', templateKey: 'order_completed' },
  { value: 'cancelled', label: 'Order Cancelled', templateKey: 'order_canceled' },
  { value: 'paid', label: 'Payment Confirmed', templateKey: 'payment_confirmation' }
];

const OrderEmailNotificationTester = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testPhone, setTestPhone] = useState('');
  const [customerName, setCustomerName] = useState('Test Customer');
  const [orderNumber, setOrderNumber] = useState('ORD-12345');
  const [customVariables, setCustomVariables] = useState('{}');
  const [templateCheck, setTemplateCheck] = useState<{[key: string]: boolean}>({});

  const checkTemplateAvailability = async () => {
    setIsRunning(true);
    const availability: {[key: string]: boolean} = {};
    
    try {
      for (const statusInfo of ORDER_STATUSES) {
        const { data, error } = await supabase
          .from('enhanced_email_templates')
          .select('id, is_active')
          .eq('template_key', statusInfo.templateKey)
          .eq('is_active', true)
          .maybeSingle();
        
        availability[statusInfo.templateKey] = !!data && !error;
      }
      
      setTemplateCheck(availability);
      toast.success('Template availability check completed');
    } catch (error) {
      console.error('Template check error:', error);
      toast.error('Failed to check template availability');
    } finally {
      setIsRunning(false);
    }
  };

  const testSingleStatus = async (status: string) => {
    setIsRunning(true);
    const statusInfo = ORDER_STATUSES.find(s => s.value === status);
    if (!statusInfo) return;

    try {
      let orderData = {
        customer_name: customerName,
        order_number: orderNumber,
        business_name: 'Starters',
        support_email: 'support@starters.com',
        current_year: new Date().getFullYear().toString(),
        estimated_ready_time: '30 minutes',
        order_type: 'delivery',
        pickup_location: 'Main Store',
        collection_deadline: '2 hours from now',
        cancellation_date: new Date().toLocaleDateString(),
        cancellation_reason: 'Customer request'
      };

      // Parse custom variables if provided
      try {
        if (customVariables.trim()) {
          const parsed = JSON.parse(customVariables);
          orderData = { ...orderData, ...parsed };
        }
      } catch (e) {
        console.warn('Invalid custom variables JSON, using defaults');
      }

      await sendOrderStatusNotification(
        'test-order-id',
        status,
        testEmail,
        testPhone || undefined,
        orderData
      );

      const result: TestResult = {
        status: statusInfo.label,
        success: true,
        message: `Email sent successfully to ${testEmail}`,
        templateKey: statusInfo.templateKey,
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => [result, ...prev]);
      toast.success(`${statusInfo.label} email sent successfully!`);

    } catch (error: any) {
      const result: TestResult = {
        status: statusInfo.label,
        success: false,
        message: error.message || 'Unknown error occurred',
        templateKey: statusInfo.templateKey,
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => [result, ...prev]);
      toast.error(`Failed to send ${statusInfo.label} email: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runFullTest = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    toast.info('Running comprehensive email notification test...');
    
    for (const status of ORDER_STATUSES) {
      try {
        await testSingleStatus(status.value);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Test failed for ${status.label}:`, error);
      }
    }
    
    setIsRunning(false);
    toast.success('Full email notification test completed!');
  };

  React.useEffect(() => {
    checkTemplateAvailability();
  }, []);

  const successCount = testResults.filter(r => r.success).length;
  const failureCount = testResults.filter(r => r.success === false).length;
  const totalTemplates = ORDER_STATUSES.length;
  const availableTemplates = Object.values(templateCheck).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Order Email Notification Testing
          </CardTitle>
          <CardDescription>
            Test and verify that email notifications are sent correctly for each order status change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Availability Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{availableTemplates}</div>
                  <div className="text-sm text-muted-foreground">Templates Available</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalTemplates}</div>
                  <div className="text-sm text-muted-foreground">Total Required</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{successCount}</div>
                  <div className="text-sm text-muted-foreground">Successful Tests</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{failureCount}</div>
                  <div className="text-sm text-muted-foreground">Failed Tests</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Test Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="testEmail">Test Email Address</Label>
                <Input
                  id="testEmail"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
              <div>
                <Label htmlFor="testPhone">Test Phone (Optional)</Label>
                <Input
                  id="testPhone"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Test Customer"
                />
              </div>
              <div>
                <Label htmlFor="orderNumber">Order Number</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="ORD-12345"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="selectedStatus">Test Single Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status to test" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          {templateCheck[status.templateKey] ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="customVariables">Custom Variables (JSON)</Label>
                <Textarea
                  id="customVariables"
                  value={customVariables}
                  onChange={(e) => setCustomVariables(e.target.value)}
                  placeholder='{"custom_field": "value"}'
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={runFullTest}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Run Full Test Suite
            </Button>
            
            <Button
              variant="outline"
              onClick={() => selectedStatus && testSingleStatus(selectedStatus)}
              disabled={!selectedStatus || isRunning}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Test Selected Status
            </Button>
            
            <Button
              variant="outline"
              onClick={checkTemplateAvailability}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              Refresh Template Check
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => setTestResults([])}
              disabled={isRunning}
            >
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Email Template Status</CardTitle>
          <CardDescription>
            Status of required email templates for order notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ORDER_STATUSES.map((status) => (
              <div key={status.value} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{status.label}</div>
                  <div className="text-sm text-muted-foreground">{status.templateKey}</div>
                </div>
                <div className="flex items-center gap-2">
                  {templateCheck[status.templateKey] ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Missing
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Recent email notification test results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.status}</span>
                      <Badge variant="outline" className="text-xs">
                        {result.templateKey}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{result.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderEmailNotificationTester;