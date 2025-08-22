// ========================================
// 📊 Supabase Function Log Monitor
// Monitor Edge Function logs for payment-related errors
// ========================================

import { supabase } from '@/integrations/supabase/client';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  function_name: string;
  metadata?: any;
}

export interface LogAnalysis {
  total_logs: number;
  error_count: number;
  warning_count: number;
  rpc_errors: LogEntry[];
  payment_errors: LogEntry[];
  recent_errors: LogEntry[];
  recommendations: string[];
}

class SupabaseLogMonitor {
  private paymentFunctions = [
    'verify-payment',
    'payment-callback',
    'enhanced-paystack-webhook',
    'process-checkout',
    'paystack-secure'
  ];

  private rpcErrorPatterns = [
    'verify_and_update_payment_status',
    'RPC failed',
    'function.*does not exist',
    'handle_successful_payment'
  ];

  private paymentErrorPatterns = [
    'Payment.*failed',
    'Order not found',
    'Amount mismatch',
    'Paystack.*error',
    'verification.*failed'
  ];

  /**
   * Note: This is a simulated log monitor since we don't have direct access to Supabase logs
   * In a real implementation, you would need to:
   * 1. Use Supabase CLI to fetch logs
   * 2. Set up log forwarding to an external service
   * 3. Use Supabase's logging API if available
   */
  async simulateLogAnalysis(): Promise<LogAnalysis> {
    console.log('🔍 Analyzing Supabase function logs for payment issues...');

    // Simulate log entries (in real implementation, fetch from Supabase)
    const simulatedLogs: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Payment verification started',
        function_name: 'verify-payment'
      },
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'error',
        message: 'RPC failed: verify_and_update_payment_status function does not exist',
        function_name: 'verify-payment',
        metadata: { reference: 'txn_test_123' }
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'warn',
        message: 'Payment amount mismatch detected',
        function_name: 'verify-payment',
        metadata: { expected: 1000, received: 1500 }
      }
    ];

    return this.analyzeLogs(simulatedLogs);
  }

  private analyzeLogs(logs: LogEntry[]): LogAnalysis {
    const errorLogs = logs.filter(log => log.level === 'error');
    const warningLogs = logs.filter(log => log.level === 'warn');

    const rpcErrors = logs.filter(log => 
      this.rpcErrorPatterns.some(pattern => 
        new RegExp(pattern, 'i').test(log.message)
      )
    );

    const paymentErrors = logs.filter(log => 
      this.paymentErrorPatterns.some(pattern => 
        new RegExp(pattern, 'i').test(log.message)
      )
    );

    const recentErrors = errorLogs.filter(log => 
      new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    const recommendations = this.generateRecommendations(rpcErrors, paymentErrors, recentErrors);

    return {
      total_logs: logs.length,
      error_count: errorLogs.length,
      warning_count: warningLogs.length,
      rpc_errors: rpcErrors,
      payment_errors: paymentErrors,
      recent_errors: recentErrors,
      recommendations
    };
  }

  private generateRecommendations(
    rpcErrors: LogEntry[], 
    paymentErrors: LogEntry[], 
    recentErrors: LogEntry[]
  ): string[] {
    const recommendations: string[] = [];

    if (rpcErrors.length > 0) {
      recommendations.push(
        `Found ${rpcErrors.length} RPC-related errors. Check if all required database functions are deployed.`
      );
    }

    if (paymentErrors.some(log => log.message.includes('verify_and_update_payment_status'))) {
      recommendations.push(
        'Critical: verify_and_update_payment_status function is missing. Deploy the latest migration.'
      );
    }

    if (paymentErrors.some(log => log.message.includes('Amount mismatch'))) {
      recommendations.push(
        'Payment amount mismatches detected. Review order total calculations and Paystack integration.'
      );
    }

    if (recentErrors.length > 5) {
      recommendations.push(
        `High error rate detected: ${recentErrors.length} errors in last 24 hours. Investigate payment flow.`
      );
    }

    if (paymentErrors.some(log => log.message.includes('Order not found'))) {
      recommendations.push(
        'Orders not found during payment verification. Check payment reference generation and storage.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('No critical issues detected in payment logs.');
    }

    return recommendations;
  }

  /**
   * Test RPC function availability by making a test call
   */
  async testRPCAvailability(): Promise<{
    available: boolean;
    error?: string;
    response_time?: number;
  }> {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.rpc('verify_and_update_payment_status', {
        payment_ref: 'test_availability_check',
        new_status: 'confirmed',
        payment_amount: 100
      });

      const responseTime = Date.now() - startTime;

      // We expect this to fail with "Order not found" if function exists
      if (error) {
        if (error.message.includes('Order not found') || error.message.includes('not found for payment reference')) {
          return {
            available: true,
            response_time: responseTime
          };
        } else if (error.message.includes('function') && error.message.includes('does not exist')) {
          return {
            available: false,
            error: 'RPC function does not exist in database'
          };
        } else {
          return {
            available: false,
            error: error.message
          };
        }
      }

      return {
        available: true,
        response_time: responseTime
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check payment transaction table for recent errors
   */
  async checkPaymentTransactionErrors(): Promise<{
    recent_errors: number;
    orphaned_payments: number;
    failed_payments: number;
  }> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Check for error status payments
      const { data: errorPayments, error: errorQuery } = await supabase
        .from('payment_transactions')
        .select('id, status, gateway_response, created_at')
        .eq('status', 'error')
        .gte('created_at', twentyFourHoursAgo);

      // Check for orphaned payments
      const { data: orphanedPayments, error: orphanQuery } = await supabase
        .from('payment_transactions')
        .select('id, status, gateway_response, created_at')
        .eq('status', 'orphaned')
        .gte('created_at', twentyFourHoursAgo);

      // Check for failed payments
      const { data: failedPayments, error: failedQuery } = await supabase
        .from('payment_transactions')
        .select('id, status, gateway_response, created_at')
        .eq('status', 'failed')
        .gte('created_at', twentyFourHoursAgo);

      if (errorQuery || orphanQuery || failedQuery) {
        console.warn('Error querying payment transactions:', { errorQuery, orphanQuery, failedQuery });
      }

      return {
        recent_errors: (errorPayments?.length || 0) + (failedPayments?.length || 0),
        orphaned_payments: orphanedPayments?.length || 0,
        failed_payments: failedPayments?.length || 0
      };
    } catch (error) {
      console.error('Failed to check payment transaction errors:', error);
      return {
        recent_errors: 0,
        orphaned_payments: 0,
        failed_payments: 0
      };
    }
  }

  /**
   * Generate a comprehensive monitoring report
   */
  async generateMonitoringReport(): Promise<{
    log_analysis: LogAnalysis;
    rpc_availability: any;
    transaction_errors: any;
    overall_health: 'healthy' | 'degraded' | 'critical';
    timestamp: string;
  }> {
    console.log('📊 Generating comprehensive payment monitoring report...');

    const [logAnalysis, rpcAvailability, transactionErrors] = await Promise.all([
      this.simulateLogAnalysis(),
      this.testRPCAvailability(),
      this.checkPaymentTransactionErrors()
    ]);

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (!rpcAvailability.available) {
      overallHealth = 'critical';
    } else if (
      logAnalysis.error_count > 5 || 
      transactionErrors.recent_errors > 3 ||
      transactionErrors.orphaned_payments > 2
    ) {
      overallHealth = 'degraded';
    }

    return {
      log_analysis: logAnalysis,
      rpc_availability: rpcAvailability,
      transaction_errors: transactionErrors,
      overall_health: overallHealth,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const supabaseLogMonitor = new SupabaseLogMonitor();

// Helper functions
export async function quickHealthCheck() {
  return await supabaseLogMonitor.testRPCAvailability();
}

export async function getPaymentErrors() {
  return await supabaseLogMonitor.checkPaymentTransactionErrors();
}

export async function getFullMonitoringReport() {
  return await supabaseLogMonitor.generateMonitoringReport();
}
