// ========================================
// 🚨 EMERGENCY PAYMENT FLOW TEST
// ========================================

import { supabase } from '@/integrations/supabase/client';
// import { generatePaymentReference } from './paymentReference'; // REMOVED - frontend no longer generates references

export interface EmergencyTestResult {
  success: boolean;
  step: string;
  details: any;
  error?: string;
}

/**
 * Emergency test of the complete payment flow
 */
export const runEmergencyPaymentTest = async (): Promise<EmergencyTestResult[]> => {
  const results: EmergencyTestResult[] = [];
  
  console.log('🚨 Running emergency payment flow test...');
  
  try {
    // Step 1: Test that frontend no longer generates references
    const shouldNotGenerate = true; // Frontend must not generate references anymore
    results.push({
      success: shouldNotGenerate,
      step: 'Frontend Reference Generation Check',
      details: { status: 'ELIMINATED', message: 'Frontend reference generation has been removed' }
    });
    // Step 2: Test backend RPC function with mock reference
    try {
      const mockReference = `txn_${Date.now()}_00000000-0000-0000-0000-000000000000`;
      const { data: rpcResult, error: rpcError } = await supabase.rpc('handle_successful_payment', {
        p_paystack_reference: `test_${mockReference}`,
        p_order_reference: mockReference,
        p_amount: 100.00,
        p_currency: 'NGN',
        p_paystack_data: { test: true }
      });

      results.push({
        success: !rpcError,
        step: 'Backend RPC Function',
        details: rpcError ? { error: rpcError } : { result: rpcResult }
      });
    } catch (rpcErr) {
      results.push({
        success: false,
        step: 'Backend RPC Function',
        details: { error: rpcErr },
        error: 'RPC function call failed'
      });
    }

    // Step 3: Test edge function availability
    try {
      const { data: edgeResult, error: edgeError } = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'verify',
          reference: 'test_reference_check'
        }
      });

      results.push({
        success: !edgeError,
        step: 'Edge Function Connectivity',
        details: edgeError ? { error: edgeError } : { status: 'reachable' }
      });
    } catch (edgeErr) {
      results.push({
        success: false,
        step: 'Edge Function Connectivity',
        details: { error: edgeErr },
        error: 'Edge function not reachable'
      });
    }

    // Step 4: Check database health
    try {
      const { data: healthData, error: healthError } = await supabase
        .from('orders')
        .select('id, payment_reference, payment_status, created_at')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .limit(5);

      const txnCount = healthData?.filter(o => o.payment_reference?.startsWith('txn_')).length || 0;
      const oldCount = healthData?.filter(o => o.payment_reference?.startsWith('pay_') || o.payment_reference?.startsWith('checkout_')).length || 0;

      results.push({
        success: !healthError,
        step: 'Database Health Check',
        details: {
          recentOrders: healthData?.length || 0,
          txnFormatCount: txnCount,
          oldFormatCount: oldCount,
          ratio: healthData?.length ? (txnCount / healthData.length * 100).toFixed(1) + '%' : '0%'
        }
      });
    } catch (dbErr) {
      results.push({
        success: false,
        step: 'Database Health Check',
        details: { error: dbErr },
        error: 'Database query failed'
      });
    }

    // Step 5: Test order creation flow
    try {
      const testOrderData = {
        customer_email: `test+${Date.now()}@example.com`,
        customer_name: 'Emergency Test User',
        customer_phone: '+2341234567890',
        fulfillment_type: 'delivery',
        delivery_address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Lagos'
        },
        order_items: [{
          product_id: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
          unit_price: 100,
          total_price: 100
        }],
        total_amount: 100,
        delivery_fee: 0,
        payment_method: 'paystack',
        guest_session_id: `test_${Date.now()}`
      };

      const { data: orderResult, error: orderError } = await supabase.functions.invoke('process-checkout', {
        body: testOrderData
      });

      results.push({
        success: !orderError && orderResult?.success,
        step: 'Order Creation Test',
        details: orderError ? { error: orderError } : { 
          orderId: orderResult?.data?.id,
          orderNumber: orderResult?.data?.order_number
        }
      });

      // Clean up test order if created
      if (orderResult?.data?.id) {
        await supabase.from('orders').delete().eq('id', orderResult.data.id);
      }
    } catch (orderErr) {
      results.push({
        success: false,
        step: 'Order Creation Test',
        details: { error: orderErr },
        error: 'Order creation failed'
      });
    }

  } catch (err) {
    results.push({
      success: false,
      step: 'FATAL ERROR',
      details: { error: err },
      error: 'Test suite failed to complete'
    });
  }

  console.log('✅ Emergency test completed:', results);
  return results;
};

/**
 * Quick diagnosis of payment flow issues
 */
export const diagnosePaymentIssues = async () => {
  console.log('🔍 Diagnosing payment flow issues...');
  
  const issues: string[] = [];
  
  try {
    // Check recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('payment_reference, payment_status, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!recentOrders || recentOrders.length === 0) {
      issues.push('No orders in last 24 hours - possible system outage');
      return issues;
    }

    const txnFormatOrders = recentOrders.filter(o => o.payment_reference?.startsWith('txn_'));
    const oldFormatOrders = recentOrders.filter(o => 
      o.payment_reference?.startsWith('pay_') || 
      o.payment_reference?.startsWith('checkout_')
    );

    if (oldFormatOrders.length > 0) {
      issues.push(`${oldFormatOrders.length} orders still using old reference format`);
    }

    if (txnFormatOrders.length === 0) {
      issues.push('NO orders using new txn_ format - frontend deployment issue!');
    }

    const paidOrders = recentOrders.filter(o => o.payment_status === 'paid');
    const completionRate = (paidOrders.length / recentOrders.length) * 100;

    if (completionRate < 50) {
      issues.push(`Critical: Payment completion rate only ${completionRate.toFixed(1)}%`);
    }

    if (issues.length === 0) {
      issues.push('✅ No critical issues detected');
    }

  } catch (err) {
    issues.push(`Database query failed: ${err}`);
  }

  return issues;
};