// ========================================
// 🔄 End-to-End Payment Flow Test
// Complete payment flow validation from order creation to completion
// ========================================

import { supabase } from '@/integrations/supabase/client';

export interface PaymentFlowTestResult {
  step: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  data?: any;
  timestamp: string;
  duration?: number;
}

export interface EndToEndTestReport {
  overall_status: 'passed' | 'failed' | 'partial';
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  test_order_id?: string;
  test_reference?: string;
  steps: PaymentFlowTestResult[];
  recommendations: string[];
  timestamp: string;
  total_duration: number;
}

class EndToEndPaymentTester {
  private results: PaymentFlowTestResult[] = [];
  private testOrderId?: string;
  private testReference?: string;
  private startTime = 0;

  private async executeStep(
    stepName: string,
    stepFunction: () => Promise<any>
  ): Promise<PaymentFlowTestResult> {
    const stepStartTime = Date.now();
    
    try {
      console.log(`🔄 Executing step: ${stepName}`);
      const data = await stepFunction();
      const duration = Date.now() - stepStartTime;
      
      const result: PaymentFlowTestResult = {
        step: stepName,
        status: 'passed',
        message: 'Step completed successfully',
        data,
        timestamp: new Date().toISOString(),
        duration
      };
      
      this.results.push(result);
      console.log(`✅ ${stepName}: PASSED (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - stepStartTime;
      const result: PaymentFlowTestResult = {
        step: stepName,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration
      };
      
      this.results.push(result);
      console.error(`❌ ${stepName}: FAILED (${duration}ms) - ${result.message}`);
      return result;
    }
  }

  async runCompletePaymentFlowTest(): Promise<EndToEndTestReport> {
    console.log('🚀 Starting complete end-to-end payment flow test...');
    this.startTime = Date.now();
    this.results = [];

    // Step 1: Create test order
    await this.executeStep('Create Test Order', async () => {
      this.testReference = `e2e_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const testOrderData = {
        customer_email: 'e2e.test@example.com',
        customer_name: 'End-to-End Test User',
        customer_phone: '+2348123456789',
        order_type: 'pickup',
        status: 'pending',
        payment_status: 'pending',
        total_amount: 500, // Small test amount
        delivery_fee: 0,
        payment_reference: this.testReference,
        created_at: new Date().toISOString()
      };

      const { data: orderData, error } = await supabase
        .from('orders')
        .insert(testOrderData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create test order: ${error.message}`);
      }

      this.testOrderId = orderData.id;
      return { order_id: orderData.id, reference: this.testReference };
    });

    // Step 2: Verify order creation
    await this.executeStep('Verify Order Creation', async () => {
      if (!this.testOrderId) {
        throw new Error('Test order ID not available');
      }

      const { data: orderData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', this.testOrderId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch created order: ${error.message}`);
      }

      if (orderData.status !== 'pending' || orderData.payment_status !== 'pending') {
        throw new Error(`Order in unexpected state: status=${orderData.status}, payment_status=${orderData.payment_status}`);
      }

      return { order: orderData };
    });

    // Step 3: Test RPC function availability
    await this.executeStep('Test RPC Function Availability', async () => {
      const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: 'availability_test_dummy',
        new_status: 'confirmed',
        payment_amount: 100
      });

      // Expected to fail with "Order not found" if function exists
      if (error) {
        if (error.message.includes('Order not found') || error.message.includes('not found for payment reference')) {
          return { function_available: true, expected_error: true };
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          throw new Error('RPC function verify_and_update_payment_status does not exist');
        } else {
          throw new Error(`Unexpected RPC error: ${error.message}`);
        }
      }

      return { function_available: true, data };
    });

    // Step 4: Simulate payment verification
    await this.executeStep('Simulate Payment Verification', async () => {
      if (!this.testReference) {
        throw new Error('Test reference not available');
      }

      const mockPaystackResponse = {
        test: true,
        reference: this.testReference,
        amount: 50000, // 500 NGN in kobo
        status: 'success',
        channel: 'test',
        currency: 'NGN',
        customer: {
          email: 'e2e.test@example.com'
        }
      };

      const { data: rpcResult, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: this.testReference,
        new_status: 'confirmed',
        payment_amount: 500,
        payment_gateway_response: mockPaystackResponse
      });

      if (error) {
        throw new Error(`Payment verification failed: ${error.message}`);
      }

      if (!rpcResult || rpcResult.length === 0) {
        throw new Error('No result returned from payment verification');
      }

      const result = rpcResult[0];
      if (result.status !== 'confirmed') {
        throw new Error(`Order not confirmed: status=${result.status}`);
      }

      return { verification_result: result };
    });

    // Step 5: Verify order status update
    await this.executeStep('Verify Order Status Update', async () => {
      if (!this.testOrderId) {
        throw new Error('Test order ID not available');
      }

      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', this.testOrderId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch updated order: ${error.message}`);
      }

      const statusTransitions = {
        status_correct: updatedOrder.status === 'confirmed',
        payment_status_correct: updatedOrder.payment_status === 'paid',
        paid_at_set: !!updatedOrder.paid_at,
        updated_at_changed: updatedOrder.updated_at !== updatedOrder.created_at
      };

      const allCorrect = Object.values(statusTransitions).every(Boolean);
      
      if (!allCorrect) {
        throw new Error(`Order status not updated correctly: ${JSON.stringify(statusTransitions)}`);
      }

      return { order: updatedOrder, transitions: statusTransitions };
    });

    // Step 6: Check payment transaction record
    await this.executeStep('Check Payment Transaction Record', async () => {
      if (!this.testReference) {
        throw new Error('Test reference not available');
      }

      const { data: transactions, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('reference', this.testReference);

      if (error) {
        throw new Error(`Failed to query payment transactions: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        throw new Error('No payment transaction record found');
      }

      const transaction = transactions[0];
      if (transaction.status !== 'completed') {
        throw new Error(`Payment transaction not completed: status=${transaction.status}`);
      }

      return { transaction };
    });

    // Step 7: Test edge function connectivity
    await this.executeStep('Test Edge Function Connectivity', async () => {
      const functions = ['verify-payment', 'payment-callback'];
      const results = {};

      for (const functionName of functions) {
        try {
          const response = await fetch(`/functions/v1/${functionName}`, {
            method: 'OPTIONS'
          });
          results[functionName] = {
            accessible: response.status < 500,
            status: response.status
          };
        } catch (error) {
          results[functionName] = {
            accessible: false,
            error: error.message
          };
        }
      }

      return results;
    });

    // Step 8: Cleanup test data
    await this.executeStep('Cleanup Test Data', async () => {
      const cleanupResults = {};

      // Delete payment transaction
      if (this.testReference) {
        const { error: txnError } = await supabase
          .from('payment_transactions')
          .delete()
          .eq('reference', this.testReference);
        
        cleanupResults['payment_transaction'] = !txnError;
        if (txnError) {
          console.warn('Failed to cleanup payment transaction:', txnError);
        }
      }

      // Delete test order
      if (this.testOrderId) {
        const { error: orderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', this.testOrderId);
        
        cleanupResults['order'] = !orderError;
        if (orderError) {
          console.warn('Failed to cleanup test order:', orderError);
        }
      }

      return cleanupResults;
    });

    // Generate report
    const totalDuration = Date.now() - this.startTime;
    const passedSteps = this.results.filter(r => r.status === 'passed').length;
    const failedSteps = this.results.filter(r => r.status === 'failed').length;

    let overallStatus: 'passed' | 'failed' | 'partial';
    if (failedSteps === 0) {
      overallStatus = 'passed';
    } else if (passedSteps > failedSteps) {
      overallStatus = 'partial';
    } else {
      overallStatus = 'failed';
    }

    const recommendations = this.generateRecommendations();

    const report: EndToEndTestReport = {
      overall_status: overallStatus,
      total_steps: this.results.length,
      passed_steps: passedSteps,
      failed_steps: failedSteps,
      test_order_id: this.testOrderId,
      test_reference: this.testReference,
      steps: this.results,
      recommendations,
      timestamp: new Date().toISOString(),
      total_duration: totalDuration
    };

    console.log('📊 End-to-end payment flow test completed:', report);
    return report;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedSteps = this.results.filter(r => r.status === 'failed');

    if (failedSteps.length === 0) {
      recommendations.push('✅ All payment flow steps completed successfully');
      recommendations.push('🎯 Payment system is fully operational');
    } else {
      recommendations.push(`⚠️ ${failedSteps.length} steps failed - requires attention`);
      
      failedSteps.forEach(step => {
        if (step.step.includes('RPC')) {
          recommendations.push('🔧 Deploy missing RPC functions using latest migrations');
        } else if (step.step.includes('Order Status')) {
          recommendations.push('📋 Check order status update logic in RPC function');
        } else if (step.step.includes('Payment Transaction')) {
          recommendations.push('💳 Verify payment transaction creation in RPC function');
        } else if (step.step.includes('Edge Function')) {
          recommendations.push('🌐 Check edge function deployment and accessibility');
        }
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const endToEndPaymentTester = new EndToEndPaymentTester();

// Helper function for quick testing
export async function runQuickPaymentFlowTest(): Promise<EndToEndTestReport> {
  return await endToEndPaymentTester.runCompletePaymentFlowTest();
}
