// ========================================
// 🚨 Production Payment System Fix Utility
// Comprehensive fixes for all payment system issues
// ========================================

import { supabase } from '@/integrations/supabase/client';

export interface FixResults {
  backfill_results: {
    success: boolean;
    processed_orders: number;
    error_count: number;
    errors: string[];
    timestamp: string;
  };
  status_fix_results: {
    success: boolean;
    fixed_orders: number;
    error_count: number;
    errors: string[];
    timestamp: string;
  };
  success: boolean;
  timestamp: string;
  message: string;
}

export interface IndividualFixResult {
  success: boolean;
  processed_orders?: number;
  fixed_orders?: number;
  error_count: number;
  errors: string[];
  timestamp: string;
}

class ProductionPaymentFixer {
  /**
   * Run comprehensive fix for all payment system issues
   */
  async runComprehensiveFix(): Promise<FixResults> {
    console.log('🚨 Starting comprehensive production payment fix...');
    
    try {
      const { data, error } = await supabase.rpc('run_comprehensive_payment_fix');
      
      if (error) {
        throw new Error(`Comprehensive fix failed: ${error.message}`);
      }

      console.log('✅ Comprehensive fix completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Comprehensive fix error:', error);
      throw error;
    }
  }

  /**
   * Backfill missing payment transaction records
   */
  async backfillMissingPaymentRecords(): Promise<IndividualFixResult> {
    console.log('💳 Starting backfill of missing payment records...');
    
    try {
      const { data, error } = await supabase.rpc('backfill_missing_payment_records');
      
      if (error) {
        throw new Error(`Backfill failed: ${error.message}`);
      }

      console.log('✅ Backfill completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Backfill error:', error);
      throw error;
    }
  }

  /**
   * Fix inconsistent order and payment statuses
   */
  async fixInconsistentStatuses(): Promise<IndividualFixResult> {
    console.log('🔄 Starting fix of inconsistent order statuses...');
    
    try {
      const { data, error } = await supabase.rpc('fix_inconsistent_order_statuses');
      
      if (error) {
        throw new Error(`Status fix failed: ${error.message}`);
      }

      console.log('✅ Status fix completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Status fix error:', error);
      throw error;
    }
  }

  /**
   * Test RPC function availability and execution
   */
  async testRPCFunctionExecution(): Promise<{
    available: boolean;
    functional: boolean;
    message: string;
    test_result?: any;
    error?: string;
  }> {
    console.log('🔧 Testing RPC function execution...');
    
    try {
      // Test with a dummy reference that we know won't exist
      const testReference = `test_rpc_execution_${Date.now()}`;
      
      const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: testReference,
        new_status: 'confirmed',
        payment_amount: 100
      });

      // Expected to fail with "Order not found" if function is working correctly
      if (error) {
        if (error.message.includes('Order not found') || error.message.includes('not found for payment reference')) {
          return {
            available: true,
            functional: true,
            message: 'RPC function is available and functioning correctly',
            test_result: 'Expected error received - function working'
          };
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          return {
            available: false,
            functional: false,
            message: 'RPC function does not exist in database',
            error: error.message
          };
        } else {
          return {
            available: true,
            functional: false,
            message: 'RPC function exists but has execution errors',
            error: error.message
          };
        }
      }

      // If no error, function exists and works
      return {
        available: true,
        functional: true,
        message: 'RPC function is available and functional',
        test_result: data
      };
    } catch (error) {
      return {
        available: false,
        functional: false,
        message: 'Failed to test RPC function',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Repair a specific order by payment reference
   */
  async repairSpecificOrder(
    paymentReference: string, 
    orderAmount?: number
  ): Promise<{
    success: boolean;
    order_data?: any;
    message: string;
    error?: string;
  }> {
    console.log(`🔧 Repairing specific order: ${paymentReference}`);
    
    try {
      const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: paymentReference,
        new_status: 'confirmed',
        payment_amount: orderAmount,
        payment_gateway_response: {
          repair: true,
          repair_timestamp: new Date().toISOString(),
          repair_type: 'manual_specific_order_repair',
          status: 'success'
        }
      });

      if (error) {
        return {
          success: false,
          message: 'Failed to repair order',
          error: error.message
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          message: 'Order not found for repair',
          error: 'No order data returned'
        };
      }

      return {
        success: true,
        order_data: data[0],
        message: 'Order repaired successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Exception during order repair',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get production system health status
   */
  async getSystemHealthStatus(): Promise<{
    rpc_function_status: any;
    recent_orders_health: {
      total_orders: number;
      paid_orders: number;
      confirmed_orders: number;
      orders_with_payment_records: number;
      consistency_rate: number;
    };
    issues_found: string[];
    overall_health: 'healthy' | 'degraded' | 'critical';
  }> {
    console.log('📊 Checking production system health...');
    
    // Test RPC function
    const rpcStatus = await this.testRPCFunctionExecution();
    
    // Check recent orders (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status, payment_status, payment_reference, total_amount')
      .gte('created_at', twentyFourHoursAgo);

    if (ordersError) {
      console.error('Error fetching recent orders:', ordersError);
    }

    const orders = recentOrders || [];
    const orderIds = orders.map(o => o.id);
    const paymentReferences = orders.filter(o => o.payment_reference).map(o => o.payment_reference);

    // Check payment transactions for these orders
    let paymentTransactions = [];
    
    if (orderIds.length > 0) {
      const { data: transactions } = await supabase
        .from('payment_transactions')
        .select('order_id, reference, status')
        .or(`order_id.in.(${orderIds.join(',')}),reference.in.(${paymentReferences.map(r => `"${r}"`).join(',')})`);
      
      paymentTransactions = transactions || [];
    }

    // Calculate health metrics
    const paidOrders = orders.filter(o => o.payment_status === 'paid').length;
    const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
    const ordersWithPaymentRecords = orders.filter(order => {
      return paymentTransactions.some(txn => 
        txn.order_id === order.id || txn.reference === order.payment_reference
      );
    }).length;

    const consistencyRate = orders.length > 0 ? (ordersWithPaymentRecords / orders.length) * 100 : 100;

    // Identify issues
    const issues = [];
    
    if (!rpcStatus.available) {
      issues.push('RPC function not available');
    }
    
    if (!rpcStatus.functional) {
      issues.push('RPC function not functional');
    }
    
    if (consistencyRate < 95) {
      issues.push(`Low payment record consistency: ${consistencyRate.toFixed(1)}%`);
    }
    
    const inconsistentOrders = orders.filter(o => 
      (o.payment_status === 'paid' && o.status !== 'confirmed') ||
      (o.status === 'confirmed' && o.payment_status !== 'paid')
    ).length;
    
    if (inconsistentOrders > 0) {
      issues.push(`${inconsistentOrders} orders with inconsistent statuses`);
    }

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'critical';
    
    if (!rpcStatus.available || consistencyRate < 80) {
      overallHealth = 'critical';
    } else if (issues.length > 0 || consistencyRate < 95) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    return {
      rpc_function_status: rpcStatus,
      recent_orders_health: {
        total_orders: orders.length,
        paid_orders: paidOrders,
        confirmed_orders: confirmedOrders,
        orders_with_payment_records: ordersWithPaymentRecords,
        consistency_rate: consistencyRate
      },
      issues_found: issues,
      overall_health: overallHealth
    };
  }
}

// Export singleton instance
export const productionPaymentFixer = new ProductionPaymentFixer();

// Helper functions for quick access
export async function runComprehensiveProductionFix(): Promise<FixResults> {
  return await productionPaymentFixer.runComprehensiveFix();
}

export async function fixMissingPaymentRecords(): Promise<IndividualFixResult> {
  return await productionPaymentFixer.backfillMissingPaymentRecords();
}

export async function fixInconsistentOrderStatuses(): Promise<IndividualFixResult> {
  return await productionPaymentFixer.fixInconsistentStatuses();
}

export async function testRPCFunction(): Promise<any> {
  return await productionPaymentFixer.testRPCFunctionExecution();
}

export async function repairOrder(paymentReference: string, amount?: number): Promise<any> {
  return await productionPaymentFixer.repairSpecificOrder(paymentReference, amount);
}

export async function getProductionHealth(): Promise<any> {
  return await productionPaymentFixer.getSystemHealthStatus();
}
