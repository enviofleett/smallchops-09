import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Send,
  Loader2,
  Eye,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmailHealthDashboard } from '@/components/admin/EmailHealthDashboard';

interface TestResult {
  id: string;
  scenario: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
  timestamp: string;
  duration?: number;
  details?: any;
}

export const EmailTestingSimulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('order_status_update');
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [customVariables, setCustomVariables] = useState('{}');
  const { toast } = useToast();

  const scenarios = [
    {
      id: 'order_status_update',
      name: 'Order Status Update',
      description: 'Test order confirmation and status change emails',
      variables: {
        customer_email: 'test@example.com',
        customer_name: 'Test Customer',
        order_number: 'ORD001234',
        new_status: 'confirmed',
        old_status: 'pending',
        total_amount: '99.99'
      }
    },
    {
      id: 'price_change',
      name: 'Price Change Alert',
      description: 'Test price change notifications for favorite products',
      variables: {
        customer_email: 'test@example.com',
        customer_name: 'Test Customer',
        product_name: 'Test Product',
        old_price: '29.99',
        new_price: '24.99',
        percentage_change: '-16.67',
        product_id: 'test-product-id'
      }
    },
    {
      id: 'promotion_alert',
      name: 'Promotion Alert',
      description: 'Test promotional email notifications',
      variables: {
        customer_email: 'test@example.com',
        customer_name: 'Test Customer',
        promotion_title: 'Summer Sale',
        promotion_description: '20% off all items',
        discount_percentage: '20',
        valid_until: '2024-12-31'
      }
    },
    {
      id: 'welcome_email',
      name: 'Welcome Email',
      description: 'Test new customer welcome emails',
      variables: {
        customer_email: 'test@example.com',
        customer_name: 'Test Customer'
      }
    },
    {
      id: 'rate_limit_test',
      name: 'Rate Limit Testing',
      description: 'Test email rate limiting functionality',
      variables: {
        customer_email: 'test@example.com',
        test_type: 'rate_limit',
        email_count: 5
      }
    }
  ];

  const addTestResult = (result: Omit<TestResult, 'timestamp'>) => {
    const newResult: TestResult = {
      ...result,
      timestamp: new Date().toISOString()
    };
    setTestResults(prev => [newResult, ...prev]);
  };

  const runSingleTest = async (scenario: any, customVars?: any) => {
    const startTime = Date.now();
    const testId = `test-${Date.now()}`;

    addTestResult({
      id: testId,
      scenario: scenario.name,
      status: 'pending',
      message: 'Starting test...'
    });

    try {
      const variables = customVars || scenario.variables;
      variables.customer_email = testEmail;

      let result;

      if (scenario.id === 'rate_limit_test') {
        // Test rate limiting by sending multiple emails
        result = await testRateLimiting(variables);
      } else {
        // Test regular email sending
        result = await testEmailSending(scenario.id, variables);
      }

      const duration = Date.now() - startTime;

      setTestResults(prev => 
        prev.map(r => 
          r.id === testId 
            ? {
                ...r,
                status: result.success ? 'success' : 'failed',
                message: result.message,
                duration,
                details: result.details
              }
            : r
        )
      );

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      setTestResults(prev => 
        prev.map(r => 
          r.id === testId 
            ? {
                ...r,
                status: 'failed',
                message: error.message,
                duration
              }
            : r
        )
      );

      return { success: false, message: error.message };
    }
  };

  const testEmailSending = async (scenarioId: string, variables: any) => {
    // Create communication event
    const { data: event, error: eventError } = await supabase
      .from('communication_events')
      .insert({
        event_type: scenarioId,
        status: 'queued',
        order_id: variables.order_id || crypto.randomUUID(), // Generate random UUID if not provided
        payload: variables,
        variables: variables
      })
      .select()
      .single();

    if (eventError) {
      throw new Error(`Failed to create event: ${eventError.message}`);
    }

    // Process the event
    const { data: processResult, error: processError } = await supabase.functions.invoke(
      'process-communication-events'
    );

    if (processError) {
      throw new Error(`Failed to process event: ${processError.message}`);
    }

    return {
      success: true,
      message: `Email event created and processed successfully`,
      details: { event, processResult }
    };
  };

  const testRateLimiting = async (variables: any) => {
    const results = [];
    const emailCount = variables.email_count || 5;

    for (let i = 0; i < emailCount; i++) {
      const { data, error } = await supabase.functions.invoke(
        'enhanced-email-rate-limiter',
        {
          body: {
            identifier: variables.customer_email,
            emailType: 'marketing',
            checkOnly: false
          }
        }
      );

      results.push({
        attempt: i + 1,
        success: !error && !data?.rateLimited,
        rateLimited: data?.rateLimited,
        currentCount: data?.currentCount,
        maxAllowed: data?.maxAllowed
      });

      if (data?.rateLimited) {
        break;
      }

      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successfulAttempts = results.filter(r => r.success).length;
    const rateLimitedAttempts = results.filter(r => r.rateLimited).length;

    return {
      success: true,
      message: `Rate limit test completed: ${successfulAttempts} successful, ${rateLimitedAttempts} rate limited`,
      details: { results }
    };
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      toast({
        title: "Starting comprehensive email tests",
        description: "Running all email scenarios..."
      });

      for (const scenario of scenarios) {
        await runSingleTest(scenario);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "All tests completed",
        description: "Check the results below for detailed information"
      });

    } catch (error: any) {
      toast({
        title: "Test suite failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runSingleScenario = async () => {
    setIsRunning(true);

    try {
      let variables;
      try {
        variables = JSON.parse(customVariables);
      } catch {
        variables = null;
      }

      const scenario = scenarios.find(s => s.id === selectedScenario);
      if (!scenario) {
        throw new Error('Scenario not found');
      }

      await runSingleTest(scenario, variables);

      toast({
        title: "Test completed",
        description: `${scenario.name} test finished`
      });

    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email System Testing & Simulation</h2>
        <p className="text-muted-foreground">
          Comprehensive end-to-end testing for the email system
        </p>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="monitoring">System Monitoring</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Test Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Quick Test
                </CardTitle>
                <CardDescription>
                  Run individual email scenarios with custom parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input
                    id="test-email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="scenario">Scenario</Label>
                  <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarios.map((scenario) => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="custom-vars">Custom Variables (JSON)</Label>
                  <Textarea
                    id="custom-vars"
                    value={customVariables}
                    onChange={(e) => setCustomVariables(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={runSingleScenario} 
                    disabled={isRunning}
                    className="flex-1"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Single Test
                  </Button>
                  <Button 
                    onClick={runAllTests} 
                    disabled={isRunning}
                    variant="secondary"
                    className="flex-1"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Activity className="h-4 w-4 mr-2" />
                    )}
                    Run All Tests
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Available Scenarios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Available Scenarios
                </CardTitle>
                <CardDescription>
                  Email scenarios that can be tested
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scenarios.map((scenario) => (
                    <div 
                      key={scenario.id} 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedScenario === scenario.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedScenario(scenario.id)}
                    >
                      <div className="font-medium">{scenario.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {scenario.description}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="monitoring">
          <EmailHealthDashboard />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Test Results
              </CardTitle>
              <CardDescription>
                Real-time results from email system tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No test results yet. Run some tests to see results here.
                </div>
              ) : (
                <div className="space-y-3">
                  {testResults.map((result) => (
                    <div 
                      key={result.id} 
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          <span className="font-medium">{result.scenario}</span>
                          {getStatusBadge(result.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(result.timestamp).toLocaleTimeString()}
                          {result.duration && (
                            <span className="ml-2">({result.duration}ms)</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm">{result.message}</div>
                      
                      {result.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};