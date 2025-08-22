// ========================================
// 🔧 Production Payment System Diagnostic
// Comprehensive analysis of payment processing in production
// ========================================

import { supabase } from '@/integrations/supabase/client';

export interface PaymentRecordGap {
  order_id: string;
  order_number: string;
  payment_reference: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  missing_transaction_record: boolean;
  payment_verified_but_no_record: boolean;
}

export interface ProductionDiagnosticReport {
  scan_timestamp: string;
  environment: 'production' | 'development';
  summary: {
    total_orders_scanned: number;
    successful_orders: number;
    orders_with_payment_records: number;
    orders_missing_payment_records: number;
    orders_with_incomplete_status: number;
    rpc_function_available: boolean;
    critical_issues_count: number;
  };
  gaps_found: PaymentRecordGap[];
  rpc_test_results: any;
  recommendations: string[];
  critical_issues: string[];
}

class ProductionPaymentDiagnostic {
  private async scanRecentOrders(hoursBack: number = 24): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    console.log(`🔍 Scanning orders from last ${hoursBack} hours (since ${cutoffTime})`);
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch recent orders: ${error.message}`);
    }

    console.log(`📊 Found ${orders?.length || 0} orders in the specified timeframe`);
    return orders || [];
  }

  private async getPaymentTransactionsForOrders(orderIds: string[]): Promise<any[]> {
    if (orderIds.length === 0) return [];
    
    const { data: transactions, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .in('order_id', orderIds);

    if (error) {
      console.warn('Error fetching payment transactions:', error);
      return [];
    }

    return transactions || [];
  }

  private async getPaymentTransactionsByReference(references: string[]): Promise<any[]> {
    if (references.length === 0) return [];
    
    const { data: transactions, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .in('reference', references);

    if (error) {
      console.warn('Error fetching payment transactions by reference:', error);
      return [];
    }

    return transactions || [];
  }

  private async testRPCFunctionAvailability(): Promise<any> {
    try {
      console.log('🔧 Testing RPC function availability...');
      
      const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: 'diagnostic_test_' + Date.now(),
        new_status: 'confirmed',
        payment_amount: 100
      });

      // Expected to fail with "Order not found" if function exists
      if (error) {
        if (error.message.includes('Order not found') || error.message.includes('not found for payment reference')) {
          return {
            available: true,
            status: 'functional',
            message: 'RPC function exists and responds correctly',
            response_time: 'fast'
          };
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          return {
            available: false,
            status: 'missing',
            message: 'RPC function does not exist in database',
            error: error.message
          };
        } else {
          return {
            available: false,
            status: 'error',
            message: 'RPC function exists but has errors',
            error: error.message
          };
        }
      }

      return {
        available: true,
        status: 'functional',
        message: 'RPC function responded successfully',
        data
      };
    } catch (error) {
      return {
        available: false,
        status: 'error',
        message: 'Failed to test RPC function',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private identifyPaymentGaps(orders: any[], transactions: any[]): PaymentRecordGap[] {
    const gaps: PaymentRecordGap[] = [];
    
    // Create maps for quick lookup
    const transactionsByOrderId = new Map();
    const transactionsByReference = new Map();
    
    transactions.forEach(txn => {
      if (txn.order_id) {
        transactionsByOrderId.set(txn.order_id, txn);
      }
      if (txn.reference) {
        transactionsByReference.set(txn.reference, txn);
      }
    });

    orders.forEach(order => {
      const hasTransactionByOrderId = transactionsByOrderId.has(order.id);
      const hasTransactionByReference = order.payment_reference ? 
        transactionsByReference.has(order.payment_reference) : false;
      
      const hasAnyTransaction = hasTransactionByOrderId || hasTransactionByReference;
      
      // Check for various gap scenarios
      const isSuccessfulOrder = order.status === 'confirmed' && order.payment_status === 'paid';
      const isPaidButNoRecord = order.payment_status === 'paid' && !hasAnyTransaction;
      const isConfirmedButNoRecord = order.status === 'confirmed' && !hasAnyTransaction;
      const hasPaymentRefButNoRecord = order.payment_reference && !hasAnyTransaction;
      
      if (isPaidButNoRecord || isConfirmedButNoRecord || hasPaymentRefButNoRecord) {
        gaps.push({
          order_id: order.id,
          order_number: order.order_number || 'Unknown',
          payment_reference: order.payment_reference || 'None',
          order_status: order.status,
          payment_status: order.payment_status,
          total_amount: order.total_amount || 0,
          created_at: order.created_at,
          missing_transaction_record: !hasAnyTransaction,
          payment_verified_but_no_record: isPaidButNoRecord
        });
      }
    });

    return gaps;
  }

  async runProductionDiagnostic(hoursToScan: number = 24): Promise<ProductionDiagnosticReport> {
    console.log('🚀 Starting Production Payment Diagnostic...');
    
    const environment = window.location.hostname.includes('localhost') ? 'development' : 'production';
    
    try {
      // Step 1: Scan recent orders
      const orders = await this.scanRecentOrders(hoursToScan);
      
      // Step 2: Get payment transactions for these orders
      const orderIds = orders.map(o => o.id);
      const paymentReferences = orders
        .filter(o => o.payment_reference)
        .map(o => o.payment_reference);
      
      const [transactionsByOrderId, transactionsByReference] = await Promise.all([
        this.getPaymentTransactionsForOrders(orderIds),
        this.getPaymentTransactionsByReference(paymentReferences)
      ]);
      
      // Combine and deduplicate transactions
      const allTransactions = [...transactionsByOrderId];
      transactionsByReference.forEach(txn => {
        if (!allTransactions.find(existing => existing.id === txn.id)) {
          allTransactions.push(txn);
        }
      });

      // Step 3: Test RPC function
      const rpcTestResults = await this.testRPCFunctionAvailability();

      // Step 4: Identify gaps
      const gaps = this.identifyPaymentGaps(orders, allTransactions);

      // Step 5: Calculate summary statistics
      const successfulOrders = orders.filter(o => 
        o.status === 'confirmed' && o.payment_status === 'paid'
      ).length;
      
      const ordersWithPaymentRecords = orders.filter(order => {
        return allTransactions.some(txn => 
          txn.order_id === order.id || txn.reference === order.payment_reference
        );
      }).length;

      const ordersMissingPaymentRecords = orders.length - ordersWithPaymentRecords;
      
      const ordersWithIncompleteStatus = orders.filter(o => 
        (o.payment_reference && o.payment_status !== 'paid') ||
        (o.payment_status === 'paid' && o.status !== 'confirmed')
      ).length;

      // Step 6: Generate recommendations and critical issues
      const { recommendations, criticalIssues } = this.generateRecommendations(
        gaps, rpcTestResults, orders, allTransactions
      );

      const report: ProductionDiagnosticReport = {
        scan_timestamp: new Date().toISOString(),
        environment,
        summary: {
          total_orders_scanned: orders.length,
          successful_orders: successfulOrders,
          orders_with_payment_records: ordersWithPaymentRecords,
          orders_missing_payment_records: ordersMissingPaymentRecords,
          orders_with_incomplete_status: ordersWithIncompleteStatus,
          rpc_function_available: rpcTestResults.available,
          critical_issues_count: criticalIssues.length
        },
        gaps_found: gaps,
        rpc_test_results: rpcTestResults,
        recommendations,
        critical_issues: criticalIssues
      };

      console.log('📊 Production diagnostic completed:', report);
      return report;

    } catch (error) {
      throw new Error(`Production diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateRecommendations(
    gaps: PaymentRecordGap[], 
    rpcResults: any, 
    orders: any[], 
    transactions: any[]
  ): { recommendations: string[]; criticalIssues: string[] } {
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    // RPC Function Issues
    if (!rpcResults.available) {
      criticalIssues.push('❌ RPC function verify_and_update_payment_status is not available');
      recommendations.push('🔧 Deploy the missing RPC function migration immediately');
    } else if (rpcResults.status === 'error') {
      criticalIssues.push('⚠️ RPC function has errors and may not process payments correctly');
      recommendations.push('🔍 Check RPC function implementation and database permissions');
    }

    // Payment Record Gaps
    if (gaps.length > 0) {
      criticalIssues.push(`❌ ${gaps.length} orders found with missing payment transaction records`);
      recommendations.push('💳 Backfill missing payment transaction records for successful orders');
      
      const paidOrdersWithoutRecords = gaps.filter(g => g.payment_status === 'paid').length;
      if (paidOrdersWithoutRecords > 0) {
        criticalIssues.push(`🚨 ${paidOrdersWithoutRecords} PAID orders have no payment transaction records`);
        recommendations.push('🔥 URGENT: Create payment transaction records for paid orders');
      }
    }

    // Order Status Inconsistencies
    const inconsistentOrders = orders.filter(o => 
      (o.payment_status === 'paid' && o.status !== 'confirmed') ||
      (o.status === 'confirmed' && o.payment_status !== 'paid')
    );
    
    if (inconsistentOrders.length > 0) {
      criticalIssues.push(`⚠️ ${inconsistentOrders.length} orders have inconsistent status (paid but not confirmed, or vice versa)`);
      recommendations.push('🔄 Review and fix order status consistency');
    }

    // Transaction Quality Issues
    const orphanedTransactions = transactions.filter(t => !t.order_id).length;
    if (orphanedTransactions > 0) {
      recommendations.push(`🧹 ${orphanedTransactions} orphaned payment transactions need order_id assignment`);
    }

    // Success Scenarios
    if (gaps.length === 0 && rpcResults.available) {
      recommendations.push('✅ Payment system is functioning correctly');
      recommendations.push('👍 All orders have proper payment transaction records');
    }

    // Performance Recommendations
    if (orders.length > 100) {
      recommendations.push('📈 Consider implementing payment record monitoring alerts for high-volume periods');
    }

    return { recommendations, criticalIssues };
  }

  async repairMissingPaymentRecords(gaps: PaymentRecordGap[]): Promise<{
    repaired: number;
    failed: number;
    errors: string[];
  }> {
    console.log(`🔧 Attempting to repair ${gaps.length} missing payment records...`);
    
    let repaired = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const gap of gaps) {
      try {
        // Use the RPC function to properly process the payment
        const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
          payment_ref: gap.payment_reference,
          new_status: 'confirmed',
          payment_amount: gap.total_amount,
          payment_gateway_response: {
            repair: true,
            original_order_id: gap.order_id,
            repair_timestamp: new Date().toISOString(),
            status: 'success'
          }
        });

        if (error) {
          failed++;
          errors.push(`Failed to repair ${gap.order_number}: ${error.message}`);
        } else {
          repaired++;
          console.log(`✅ Repaired payment record for order ${gap.order_number}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Exception repairing ${gap.order_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { repaired, failed, errors };
  }
}

// Export singleton instance
export const productionPaymentDiagnostic = new ProductionPaymentDiagnostic();

// Quick diagnostic functions
export async function runQuickProductionDiagnostic() {
  return await productionPaymentDiagnostic.runProductionDiagnostic(24);
}

export async function runExtendedProductionDiagnostic() {
  return await productionPaymentDiagnostic.runProductionDiagnostic(72);
}

export async function repairPaymentGaps(gaps: PaymentRecordGap[]) {
  return await productionPaymentDiagnostic.repairMissingPaymentRecords(gaps);
}
