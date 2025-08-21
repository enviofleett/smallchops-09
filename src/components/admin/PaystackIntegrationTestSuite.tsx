import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Play, TestTube, CreditCard, ShoppingCart } from 'lucide-react';
import { debugPaystackEnvironment } from '@/utils/testPaystackEnv';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  message: string;
  details?: any;
  duration?: number;
}

interface TestSuite {
  environment: TestResult;
  initialization: TestResult;
  checkoutFlow: TestResult;
  paymentCallback: TestResult;
  errorHandling: TestResult;
}

const PaystackIntegrationTestSuite = () => {
  const [testResults, setTestResults] = useState<Partial<TestSuite>>({});
  const [isRunningFullSuite, setIsRunningFullSuite] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const { toast } = useToast();

  // Test 1: Environment Variable Accessibility
  const testEnvironmentVariable = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const envResult = await debugPaystackEnvironment();
      const duration = Date.now() - startTime;

      if (envResult.status === 'working') {
        return {
          name: 'Environment Variable Test',
          status: 'pass',
          message: 'PAYSTACK_SECRET_KEY_TEST is accessible and valid',
          details: envResult,
          duration
        };
      } else if (envResult.status === 'environment_accessible') {
        return {
          name: 'Environment Variable Test',
          status: 'warning',
          message: 'Environment variable accessible but API has issues',
          details: envResult,
          duration
        };
      } else {
        return {
          name: 'Environment Variable Test',
          status: 'fail',
          message: envResult.message,
          details: envResult,
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Environment Variable Test',
        status: 'fail',
        message: `Environment test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Test 2: Payment Initialization
  const testPaymentInitialization = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const testPayload = {
        action: 'initialize',
        email: 'test@startersmallchops.com',
        amount: 1000, // 10 NGN
        reference: `integration_test_${Date.now()}`,
        metadata: {
          test: true,
          description: 'End-to-end integration test'
        }
      };

      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: testPayload
      });

      const duration = Date.now() - startTime;

      if (error) {
        return {
          name: 'Payment Initialization Test',
          status: 'fail',
          message: `Initialization failed: ${error.message}`,
          details: { error, payload: testPayload },
          duration
        };
      }

      if (data?.status && data?.data?.authorization_url) {
        return {
          name: 'Payment Initialization Test',
          status: 'pass',
          message: 'Payment initialization successful with authorization URL',
          details: {
            reference: data.data.reference,
            authorization_url: data.data.authorization_url,
            access_code: data.data.access_code
          },
          duration
        };
      } else {
        return {
          name: 'Payment Initialization Test',
          status: 'fail',
          message: 'Invalid response from payment initialization',
          details: data,
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Payment Initialization Test',
        status: 'fail',
        message: `Test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Test 3: Checkout Flow End-to-End
  const testCheckoutFlow = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      // Simulate a complete checkout process
      const checkoutPayload = {
        customer_name: 'Test Customer',
        customer_email: 'test@startersmallchops.com',
        customer_phone: '08012345678',
        fulfillment_type: 'pickup',
        pickup_point_id: '123',
        order_items: [
          {
            product_id: 'test-product-123',
            product_name: 'Test Small Chops',
            quantity: 2,
            price: 500,
            unit_price: 500,
            discount_amount: 0
          }
        ],
        total_amount: 1000,
        payment_method: 'paystack'
      };

      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: checkoutPayload
      });

      const duration = Date.now() - startTime;

      if (error) {
        return {
          name: 'Checkout Flow Test',
          status: 'fail',
          message: `Checkout flow failed: ${error.message}`,
          details: { error, payload: checkoutPayload },
          duration
        };
      }

      if (data?.success && (data?.payment_url || data?.authorization_url)) {
        return {
          name: 'Checkout Flow Test',
          status: 'pass',
          message: 'Complete checkout flow successful',
          details: {
            order_id: data.order_id,
            payment_reference: data.payment_reference,
            payment_url: data.payment_url || data.authorization_url
          },
          duration
        };
      } else {
        return {
          name: 'Checkout Flow Test',
          status: 'fail',
          message: 'Checkout flow completed but missing payment URL',
          details: data,
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Checkout Flow Test',
        status: 'fail',
        message: `Checkout test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Test 4: Payment Callback/Verification
  const testPaymentCallback = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      // Test the payment verification endpoint
      const testReference = `callback_test_${Date.now()}`;
      
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          reference: testReference
        }
      });

      const duration = Date.now() - startTime;

      // For this test, we expect it to fail gracefully (since it's a fake reference)
      // but the function should be accessible and return proper error structure
      if (error && error.message.includes('Payment not found')) {
        return {
          name: 'Payment Callback Test',
          status: 'pass',
          message: 'Payment verification endpoint accessible and handling errors correctly',
          details: { error: error.message, reference: testReference },
          duration
        };
      } else if (error && error.message.includes('Paystack secret key')) {
        return {
          name: 'Payment Callback Test',
          status: 'fail',
          message: 'Payment verification failed due to configuration',
          details: { error: error.message },
          duration
        };
      } else {
        return {
          name: 'Payment Callback Test',
          status: 'warning',
          message: 'Unexpected response from payment verification',
          details: { data, error },
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Payment Callback Test',
        status: 'fail',
        message: `Callback test failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Test 5: Error Handling
  const testErrorHandling = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      // Test with invalid data to ensure proper error handling
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          // Missing required fields
          email: '',
          amount: -100
        }
      });

      const duration = Date.now() - startTime;

      if (error || (data && !data.status)) {
        return {
          name: 'Error Handling Test',
          status: 'pass',
          message: 'Error handling working correctly - invalid input rejected',
          details: { error: error?.message || data?.error },
          duration
        };
      } else {
        return {
          name: 'Error Handling Test',
          status: 'fail',
          message: 'Error handling failed - invalid input was accepted',
          details: data,
          duration
        };
      }
    } catch (error) {
      return {
        name: 'Error Handling Test',
        status: 'pass',
        message: 'Error handling working - exception caught properly',
        details: { error: error.message },
        duration: Date.now() - startTime
      };
    }
  };

  // Run individual test
  const runIndividualTest = async (testName: string) => {
    setCurrentTest(testName);
    setTestResults(prev => ({
      ...prev,
      [testName]: { name: testName, status: 'running', message: 'Running test...' }
    }));

    let result: TestResult;
    
    switch (testName) {
      case 'environment':
        result = await testEnvironmentVariable();
        break;
      case 'initialization':
        result = await testPaymentInitialization();
        break;
      case 'checkoutFlow':
        result = await testCheckoutFlow();
        break;
      case 'paymentCallback':
        result = await testPaymentCallback();
        break;
      case 'errorHandling':
        result = await testErrorHandling();
        break;
      default:
        result = { name: testName, status: 'fail', message: 'Unknown test' };
    }

    setTestResults(prev => ({
      ...prev,
      [testName]: result
    }));

    setCurrentTest('');
    
    if (result.status === 'pass') {
      toast({
        title: "Test Passed",
        description: `${result.name} completed successfully`,
      });
    } else {
      toast({
        title: "Test Failed",
        description: `${result.name}: ${result.message}`,
        variant: "destructive"
      });
    }
  };

  // Run full test suite
  const runFullTestSuite = async () => {
    setIsRunningFullSuite(true);
    setTestResults({});

    const tests = ['environment', 'initialization', 'checkoutFlow', 'paymentCallback', 'errorHandling'];
    
    for (const test of tests) {
      await runIndividualTest(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsRunningFullSuite(false);

    // Check overall results
    const results = Object.values(testResults);
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    if (failCount === 0) {
      toast({
        title: "All Tests Passed! 🎉",
        description: `Paystack integration is working perfectly (${passCount}/${results.length} tests passed)`,
      });
    } else {
      toast({
        title: "Some Tests Failed",
        description: `${failCount} tests failed, ${passCount} passed. Check results for details.`,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <TestTube className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pass':
        return 'default' as const;
      case 'warning':
        return 'secondary' as const;
      case 'fail':
        return 'destructive' as const;
      case 'running':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paystack Integration Test Suite
          </CardTitle>
          <CardDescription>
            Comprehensive end-to-end testing of the Paystack payment integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Control Buttons */}
          <div className="flex gap-4">
            <Button 
              onClick={runFullTestSuite} 
              disabled={isRunningFullSuite || currentTest !== ''}
              className="flex-1"
            >
              {isRunningFullSuite ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Full Test Suite...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Complete Test Suite
                </>
              )}
            </Button>
          </div>

          {/* Test Results */}
          <div className="space-y-4">
            {[
              { key: 'environment', name: 'Environment Variable Access', icon: TestTube },
              { key: 'initialization', name: 'Payment Initialization', icon: CreditCard },
              { key: 'checkoutFlow', name: 'Complete Checkout Flow', icon: ShoppingCart },
              { key: 'paymentCallback', name: 'Payment Verification', icon: CheckCircle },
              { key: 'errorHandling', name: 'Error Handling', icon: AlertTriangle }
            ].map(({ key, name, icon: Icon }) => {
              const result = testResults[key];
              return (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result?.status || 'pending')}
                    <div>
                      <h4 className="font-medium">{name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {result?.message || 'Not yet run'}
                      </p>
                      {result?.duration && (
                        <p className="text-xs text-muted-foreground">
                          Duration: {result.duration}ms
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && (
                      <Badge variant={getStatusBadgeVariant(result.status)}>
                        {result.status.toUpperCase()}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runIndividualTest(key)}
                      disabled={isRunningFullSuite || currentTest === key}
                    >
                      {currentTest === key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Results */}
          {Object.entries(testResults).map(([key, result]) => (
            result.details && (
              <Alert key={key} variant={result.status === 'fail' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">{result.name} Details:</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaystackIntegrationTestSuite;
