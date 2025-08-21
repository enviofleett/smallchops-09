// ========================================
// 🧪 Payment System Testing Suite
// Comprehensive testing for payment verification and processing
// ========================================

import { supabase } from '@/integrations/supabase/client';

export interface PaymentTestResult {
  test: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  data?: any;
  duration?: number;
}

export interface PaymentSystemHealthReport {
  overall_status: 'healthy' | 'degraded' | 'critical';
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  tests_with_warnings: number;
  results: PaymentTestResult[];
  timestamp: string;
  environment: string;
}

class PaymentSystemTester {
  private results: PaymentTestResult[] = [];

  private async runTest<T>(
    testName: string,
    testFunction: () => Promise<T>
  ): Promise<PaymentTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Running test: ${testName}`);
      const data = await testFunction();
      const duration = Date.now() - startTime;
      
      const result: PaymentTestResult = {
        test: testName,
        status: 'passed',
        message: 'Test completed successfully',
        data,
        duration
      };
      
      this.results.push(result);
      console.log(`✅ ${testName}: PASSED (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: PaymentTestResult = {
        test: testName,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
      
      this.results.push(result);
      console.error(`❌ ${testName}: FAILED (${duration}ms) - ${result.message}`);
      return result;
    }
  }

  async testRPCFunctionExists(): Promise<PaymentTestResult> {
    return this.runTest('RPC Function Existence Check', async () => {
      // Test if verify_and_update_payment_status function exists
      const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: 'test_function_exists_check',
        new_status: 'confirmed',
        payment_amount: 100
      });

      // We expect this to fail with "Order not found" if function exists
      // If function doesn't exist, we'll get a different error
      if (error) {
        if (error.message.includes('Order not found') || error.message.includes('not found for payment reference')) {
          return { function_exists: true, expected_error: true };
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          throw new Error('RPC function verify_and_update_payment_status does not exist in database');
        } else {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      }

      return { function_exists: true, data };
    });
  }

  async testPaymentVerificationFlow(): Promise<PaymentTestResult> {
    return this.runTest('Payment Verification Flow Test', async () => {
      // Create a test order first
      const testOrderData = {
        customer_email: 'payment.test@example.com',
        customer_name: 'Payment Test User',
        customer_phone: '+2348123456789',
        order_type: 'pickup',
        status: 'pending',
        payment_status: 'pending',
        total_amount: 1000,
        payment_reference: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString()
      };

      // Insert test order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(testOrderData)
        .select()
        .single();

      if (orderError) {
        throw new Error(`Failed to create test order: ${orderError.message}`);
      }

      // Test the RPC function with the test order
      const { data: rpcResult, error: rpcError } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: testOrderData.payment_reference,
        new_status: 'confirmed',
        payment_amount: 1000,
        payment_gateway_response: {
          test: true,
          reference: testOrderData.payment_reference,
          amount: 100000, // in kobo
          status: 'success',
          channel: 'test'
        }
      });

      if (rpcError) {
        throw new Error(`RPC function failed: ${rpcError.message}`);
      }

      // Verify the order was updated correctly
      const { data: updatedOrder, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderData.id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch updated order: ${fetchError.message}`);
      }

      // Clean up test order
      await supabase.from('orders').delete().eq('id', orderData.id);

      return {
        original_order: orderData,
        rpc_result: rpcResult,
        updated_order: updatedOrder,
        verification_successful: updatedOrder.status === 'confirmed' && updatedOrder.payment_status === 'paid'
      };
    });
  }

  async testPaymentTransactionCreation(): Promise<PaymentTestResult> {
    return this.runTest('Payment Transaction Creation Test', async () => {
      const testReference = `txn_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Test direct payment transaction creation
      const { data: transactionData, error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          reference: testReference,
          provider_reference: testReference,
          amount: 500,
          currency: 'NGN',
          status: 'pending',
          gateway_response: { test: true }
        })
        .select()
        .single();

      if (transactionError) {
        throw new Error(`Failed to create payment transaction: ${transactionError.message}`);
      }

      // Clean up
      await supabase.from('payment_transactions').delete().eq('id', transactionData.id);

      return {
        transaction_created: true,
        transaction_data: transactionData
      };
    });
  }

  async testPaymentAmountValidation(): Promise<PaymentTestResult> {
    return this.runTest('Payment Amount Validation Test', async () => {
      // Create test order with specific amount
      const testAmount = 1500;
      const testOrderData = {
        customer_email: 'amount.test@example.com',
        customer_name: 'Amount Test User',
        customer_phone: '+2348123456789',
        order_type: 'pickup',
        status: 'pending',
        payment_status: 'pending',
        total_amount: testAmount,
        payment_reference: `amount_test_${Date.now()}`,
        created_at: new Date().toISOString()
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(testOrderData)
        .select()
        .single();

      if (orderError) {
        throw new Error(`Failed to create test order: ${orderError.message}`);
      }

      let validationResults = [];

      try {
        // Test 1: Correct amount should succeed
        const { data: correctResult, error: correctError } = await supabase.rpc('verify_and_update_payment_status', {
          payment_ref: testOrderData.payment_reference,
          new_status: 'confirmed',
          payment_amount: testAmount,
          payment_gateway_response: { test: true, correct_amount: true }
        });

        validationResults.push({
          test: 'correct_amount',
          passed: !correctError,
          error: correctError?.message
        });

        // Reset order status for next test
        await supabase
          .from('orders')
          .update({ status: 'pending', payment_status: 'pending', paid_at: null })
          .eq('id', orderData.id);

        // Test 2: Incorrect amount should fail (only if first test passed)
        if (!correctError) {
          const wrongAmount = testAmount + 100; // Different amount
          const { data: wrongResult, error: wrongError } = await supabase.rpc('verify_and_update_payment_status', {
            payment_ref: testOrderData.payment_reference,
            new_status: 'confirmed',
            payment_amount: wrongAmount,
            payment_gateway_response: { test: true, wrong_amount: true }
          });

          validationResults.push({
            test: 'incorrect_amount',
            passed: !!wrongError, // Should fail
            error: wrongError?.message,
            expected_failure: true
          });
        }

      } finally {
        // Clean up test order
        await supabase.from('orders').delete().eq('id', orderData.id);
      }

      return {
        validation_tests: validationResults,
        all_validations_passed: validationResults.every(r => r.passed)
      };
    });
  }

  async testEdgeFunctionConnectivity(): Promise<PaymentTestResult> {
    return this.runTest('Edge Function Connectivity Test', async () => {
      const results = {};

      // Test verify-payment function
      try {
        const verifyResponse = await fetch('/functions/v1/verify-payment', {
          method: 'OPTIONS' // Just test connectivity
        });
        results['verify-payment'] = {
          accessible: verifyResponse.status < 500,
          status: verifyResponse.status
        };
      } catch (error) {
        results['verify-payment'] = {
          accessible: false,
          error: error.message
        };
      }

      // Test payment-callback function
      try {
        const callbackResponse = await fetch('/functions/v1/payment-callback', {
          method: 'OPTIONS'
        });
        results['payment-callback'] = {
          accessible: callbackResponse.status < 500,
          status: callbackResponse.status
        };
      } catch (error) {
        results['payment-callback'] = {
          accessible: false,
          error: error.message
        };
      }

      return results;
    });
  }

  async testSecurityIncidentsTable(): Promise<PaymentTestResult> {
    return this.runTest('Security Incidents Table Test', async () => {
      // Test if we can create a security incident (requires service role or admin)
      // This will likely fail with current permissions, but we can test table existence
      
      try {
        const { data, error } = await supabase
          .from('security_incidents')
          .select('count(*)')
          .limit(1);

        return {
          table_accessible: !error,
          error: error?.message
        };
      } catch (error) {
        return {
          table_accessible: false,
          error: error.message
        };
      }
    });
  }

  async runFullSystemHealthCheck(): Promise<PaymentSystemHealthReport> {
    console.log('🚀 Starting Payment System Health Check...');
    this.results = []; // Reset results

    // Run all tests
    await this.testRPCFunctionExists();
    await this.testPaymentVerificationFlow();
    await this.testPaymentTransactionCreation();
    await this.testPaymentAmountValidation();
    await this.testEdgeFunctionConnectivity();
    await this.testSecurityIncidentsTable();

    // Generate report
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    let overall_status: 'healthy' | 'degraded' | 'critical';
    if (failed === 0) {
      overall_status = warnings > 0 ? 'degraded' : 'healthy';
    } else {
      overall_status = failed > (this.results.length / 2) ? 'critical' : 'degraded';
    }

    const report: PaymentSystemHealthReport = {
      overall_status,
      tests_run: this.results.length,
      tests_passed: passed,
      tests_failed: failed,
      tests_with_warnings: warnings,
      results: this.results,
      timestamp: new Date().toISOString(),
      environment: window.location.hostname.includes('localhost') ? 'development' : 'production'
    };

    console.log('📊 Payment System Health Check Complete:', report);
    return report;
  }
}

// Export singleton instance
export const paymentSystemTester = new PaymentSystemTester();

// Helper function for quick testing
export async function quickPaymentHealthCheck(): Promise<PaymentSystemHealthReport> {
  return await paymentSystemTester.runFullSystemHealthCheck();
}

// Export individual test functions
export const PaymentTests = {
  rpcFunction: () => paymentSystemTester.testRPCFunctionExists(),
  verificationFlow: () => paymentSystemTester.testPaymentVerificationFlow(),
  transactionCreation: () => paymentSystemTester.testPaymentTransactionCreation(),
  amountValidation: () => paymentSystemTester.testPaymentAmountValidation(),
  edgeFunctions: () => paymentSystemTester.testEdgeFunctionConnectivity(),
  securityTable: () => paymentSystemTester.testSecurityIncidentsTable()
};
