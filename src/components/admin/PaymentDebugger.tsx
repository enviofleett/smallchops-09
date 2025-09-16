import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Bug, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export const PaymentDebugger: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  // ✅ NEW: Debug process-checkout functionality
  const debugProcessCheckout = async (): Promise<DiagnosticResult> => {
    console.log('🔍 Testing process-checkout response structure...');
    
    try {
      const testPayload = {
        customer: {
          name: 'Debug Test',
          email: 'test@debug.com',
          phone: '08012345678'
        },
        items: [{
          product_id: 'debug-test-item',
          product_name: 'Debug Test Item',
          quantity: 1,
          unit_price: 1000
        }],
        fulfillment: {
          type: 'pickup',
          pickup_point_id: '00000000-0000-0000-0000-000000000001'
        },
        payment: {
          method: 'paystack'
        }
      };
      
      const response = await supabase.functions.invoke('process-checkout', {
        body: testPayload
      });
      
      console.log('🔍 Process-checkout debug response:', response);
      
      if (response.error) {
        return {
          name: 'Process-checkout Debug',
          status: 'fail',
          message: `Function error: ${response.error.message}`,
          details: response.error
        };
      }
      
      const data = response.data;
      const payment = data?.payment || {};
      
      const diagnostics = {
        success: data?.success,
        hasOrderId: !!data?.order_id,
        hasPaymentObject: !!data?.payment,
        hasPaymentUrl: !!(payment.payment_url || payment.authorization_url),
        hasAccessCode: !!payment.access_code,
        hasReference: !!payment.reference,
        referenceFormat: payment.reference?.startsWith('txn_') ? 'correct (txn_)' : 'incorrect',
        computedUrl: payment.access_code ? `https://checkout.paystack.com/${payment.access_code}` : 'cannot compute'
      };
      
      const issues = [];
      if (!data?.success) issues.push('success !== true');
      if (!payment.payment_url && !payment.authorization_url) issues.push('missing payment URLs');
      if (!payment.access_code) issues.push('missing access_code');
      if (!payment.reference?.startsWith('txn_')) issues.push('invalid reference format');
      
      return {
        name: 'Process-checkout Debug',
        status: issues.length === 0 ? 'pass' : 'warning',
        message: issues.length === 0 
          ? 'Process-checkout returns complete payment data' 
          : `Issues found: ${issues.join(', ')}`,
        details: diagnostics
      };
      
    } catch (error: any) {
      return {
        name: 'Process-checkout Debug',
        status: 'fail',
        message: `Debug test failed: ${error.message}`,
        details: error
      };
    }
  };

  const runQuickDiagnostic = async () => {
    setIsRunning(true);
    const diagnostics: DiagnosticResult[] = [];

    try {
      console.log('🧪 Running payment system diagnostic...');

      // Test 1: Check business settings
      try {
        const { data: settings, error } = await supabase
          .from('business_info')
          .select('allow_guest_checkout')
          .single();
        
        if (error) {
          diagnostics.push({
            name: 'Business Settings',
            status: 'fail',
            message: 'Cannot access business settings',
            details: error
          });
        } else {
          diagnostics.push({
            name: 'Business Settings',
            status: 'pass',
            message: `Guest checkout: ${settings?.allow_guest_checkout ? 'enabled' : 'disabled'}`,
            details: settings
          });
        }
      } catch (error) {
        diagnostics.push({
          name: 'Business Settings',
          status: 'fail',
          message: 'Database connection failed',
          details: error
        });
      }

      // Test 2: Check edge function connectivity
      try {
        const { data, error } = await supabase.functions.invoke('paystack-secure', {
          body: { action: 'health-check' }
        });
        
        if (error) {
          diagnostics.push({
            name: 'Edge Functions',
            status: 'fail',
            message: 'Cannot connect to payment services',
            details: error
          });
        } else {
          diagnostics.push({
            name: 'Edge Functions',
            status: 'pass',
            message: 'Payment services accessible',
            details: data
          });
        }
      } catch (error) {
        diagnostics.push({
          name: 'Edge Functions',
          status: 'warning',
          message: 'Edge function test inconclusive',
          details: error
        });
      }

      // Test 3: Recent payment transactions
      try {
        const { data: transactions, error } = await supabase
          .from('payment_transactions')
          .select('provider_reference, status, created_at')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (error) {
          diagnostics.push({
            name: 'Payment Transactions',
            status: 'fail',
            message: 'Cannot access payment data',
            details: error
          });
        } else {
          const hasCorrectFormat = transactions?.every(t => 
            t.provider_reference && t.provider_reference.startsWith('txn_')
          ) ?? false;
          
          diagnostics.push({
            name: 'Transaction Format',
            status: hasCorrectFormat ? 'pass' : 'warning',
            message: hasCorrectFormat 
              ? 'All references use correct txn_ format'
              : 'Some references may use legacy format',
            details: { 
              count: transactions?.length || 0,
              samples: transactions?.slice(0, 2)
            }
          });
        }
      } catch (error) {
        diagnostics.push({
          name: 'Payment Transactions',
          status: 'fail',
          message: 'Transaction check failed',
          details: error
        });
      }

      // Test 4: Test a simple checkout call
      try {
        const testPayload = {
          customer: {
            name: 'Test User',
            email: 'test@example.com',
            phone: '1234567890'
          },
          items: [{
            product_id: 'test-product',
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 1000
          }],
          fulfillment: {
            type: 'delivery'
          },
          payment: {
            method: 'paystack'
          }
        };

        const { data, error } = await supabase.functions.invoke('process-checkout', {
          body: testPayload
        });

        if (error) {
          diagnostics.push({
            name: 'Checkout Test',
            status: 'fail',
            message: `Checkout test failed: ${error.message}`,
            details: error
          });
        } else if (data?.success) {
          diagnostics.push({
            name: 'Checkout Test',
            status: 'pass',
            message: 'Test checkout successful',
            details: data
          });
        } else {
          diagnostics.push({
            name: 'Checkout Test',
            status: 'warning',
            message: 'Checkout test returned non-success response',
            details: data
          });
        }
      } catch (error) {
        diagnostics.push({
          name: 'Checkout Test',
          status: 'fail',
          message: 'Checkout test error',
          details: error
        });
      }

      // Run process-checkout debug test
      const processCheckoutResult = await debugProcessCheckout();
      diagnostics.push(processCheckoutResult);

      setResults(diagnostics);
      console.log('✅ Diagnostic completed', diagnostics);

    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      setResults([{
        name: 'System Error',
        status: 'fail',
        message: 'Diagnostic system encountered an error',
        details: error
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="secondary" className="bg-green-50 text-green-700">Pass</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">Warning</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Payment System Debugger
        </CardTitle>
        <CardDescription>
          Quick diagnostic tool to identify payment system issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runQuickDiagnostic}
          disabled={isRunning}
          variant="outline"
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            <>
              <Bug className="h-4 w-4 mr-2" />
              Run Quick Diagnostic
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Results</h4>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>{results.filter(r => r.status === 'pass').length} passed</span>
                <span>{results.filter(r => r.status === 'warning').length} warnings</span>
                <span>{results.filter(r => r.status === 'fail').length} failed</span>
              </div>
            </div>

            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.name}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Show details
                        </summary>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};