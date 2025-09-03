import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sendOrderStatusNotification, getNotificationLogs } from '@/api/notifications';

interface TestResult {
  status: string;
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  message: string;
  templateKey: string;
  timestamp: string;
}

interface DeliveryAttempt {
  id: string;
  order_id?: string;
  template_key?: string;
  recipient: string;
  channel: string;
  status: string;
  error_message?: string;
  created_at: string;
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
  const [deliveryAttempts, setDeliveryAttempts] = useState<DeliveryAttempt[]>([]);
  const [loadingDeliveryAttempts, setLoadingDeliveryAttempts] = useState(false);

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

  const loadDeliveryAttempts = async () => {
    setLoadingDeliveryAttempts(true);
    try {
      // Try notification_delivery_log first
      const logs = await getNotificationLogs({ limit: 20 });
      if (logs.length > 0) {
        setDeliveryAttempts(logs.map(log => ({
          id: log.id!,
          order_id: log.order_id,
          template_key: log.template_id, // Note: notification_delivery_log uses template_id
          recipient: log.recipient,
          channel: log.channel,
          status: log.status,
          error_message: log.error_message,
          created_at: log.created_at!
        })));
      } else {
        // Fallback to communication_events if no logs found
        const { data: events } = await supabase
          .from('communication_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (events) {
          setDeliveryAttempts(events.map(event => ({
            id: event.id,
            order_id: event.order_id,
            template_key: event.template_key,
            recipient: event.recipient_email || 'Unknown',
            channel: 'email',
            status: event.status,
            error_message: event.error_message,
            created_at: event.created_at
          })));
        }
      }
    } catch (error) {
      console.error('Failed to load delivery attempts:', error);
    } finally {
      setLoadingDeliveryAttempts(false);
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

      const result = await sendOrderStatusNotification(
        'test-order-id',
        status,
        testEmail,
        testPhone || undefined,
        orderData
      );

      const testResult: TestResult = {
        status: statusInfo.label,
        success: result.success,
        emailSent: result.emailSent,
        smsSent: result.smsSent,
        message: result.message,
        templateKey: statusInfo.templateKey,
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => [testResult, ...prev]);
      
      if (result.success) {
        toast.success(`${statusInfo.label} notifications sent successfully!`);
      } else if (result.emailSent || result.smsSent) {
        toast.warning(`${statusInfo.label}: Partial success - ${result.message}`);
      } else {
        toast.error(`${statusInfo.label}: Failed - ${result.message}`);
      }

      // Refresh delivery attempts after test
      loadDeliveryAttempts();

    } catch (error: any) {
      const testResult: TestResult = {
        status: statusInfo.label,
        success: false,
        emailSent: false,
        smsSent: false,
        message: error.message || 'Unknown error occurred',
        templateKey: statusInfo.templateKey,
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => [testResult, ...prev]);
      toast.error(`Failed to send ${statusInfo.label} notifications: ${error.message}`);
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

  useEffect(() => {
    checkTemplateAvailability();
    loadDeliveryAttempts();
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
              variant="outline"
              onClick={loadDeliveryAttempts}
              disabled={loadingDeliveryAttempts}
              className="flex items-center gap-2"
            >
              <Zap className={`h-4 w-4 ${loadingDeliveryAttempts ? 'animate-spin' : ''}`} />
              Refresh Delivery Log
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

      {/* Recent Delivery Attempts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Delivery Attempts</CardTitle>
          <CardDescription>
            Latest email/SMS delivery attempts from the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDeliveryAttempts ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading delivery attempts...</span>
            </div>
          ) : deliveryAttempts.length > 0 ? (
            <div className="space-y-3">
              {deliveryAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    attempt.status === 'sent' || attempt.status === 'delivered' 
                      ? 'bg-green-50 border-green-200' 
                      : attempt.status === 'pending' 
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {attempt.status === 'sent' || attempt.status === 'delivered' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : attempt.status === 'pending' ? (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{attempt.status}</span>
                      <Badge variant="outline" className="text-xs">
                        {attempt.channel}
                      </Badge>
                      {attempt.template_key && (
                        <Badge variant="secondary" className="text-xs">
                          {attempt.template_key}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      To: {attempt.recipient}
                      {attempt.order_id && ` | Order: ${attempt.order_id}`}
                    </div>
                    {attempt.error_message && (
                      <div className="text-sm text-red-600 mt-1">
                        Error: {attempt.error_message}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(attempt.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No delivery attempts found. Try running a test to see results here.
            </div>
          )}
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
                    result.success ? 'bg-green-50 border-green-200' : 
                    (result.emailSent || result.smsSent) ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (result.emailSent || result.smsSent) ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
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
                      {result.emailSent && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                          Email ✓
                        </Badge>
                      )}
                      {result.smsSent && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                          SMS ✓
                        </Badge>
                      )}
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