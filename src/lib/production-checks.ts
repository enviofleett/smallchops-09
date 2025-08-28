
import { supabase } from '@/integrations/supabase/client';

export interface ProductionCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface ProductionReadiness {
  isReady: boolean;
  score: number;
  checks: ProductionCheck[];
  criticalIssues: string[];
  warnings: string[];
}

export class ProductionValidator {
  static async validateDatabaseHealth(): Promise<ProductionCheck[]> {
    const checks: ProductionCheck[] = [];

    try {
      // Test database connection with orders_view
      const { data, error } = await supabase.from('orders_view').select('id').limit(1);
      
      if (error) {
        checks.push({
          name: 'Database Connection',
          status: 'fail',
          message: `Database connection failed: ${error.message}`
        });
      } else {
        checks.push({
          name: 'Database Connection',
          status: 'pass',
          message: 'Database connection is healthy'
        });
      }

      // Check for email column consistency
      const { data: emailData, error: emailError } = await supabase
        .from('orders')
        .select('email, customer_email')
        .limit(1);

      if (emailError) {
        checks.push({
          name: 'Email Column Consistency',
          status: 'fail',
          message: `Email column issues detected: ${emailError.message}`
        });
      } else {
        checks.push({
          name: 'Email Column Consistency',
          status: 'pass',
          message: 'Email columns are properly configured'
        });
      }

    } catch (error) {
      checks.push({
        name: 'Database Health',
        status: 'fail',
        message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return checks;
  }

  static async validatePaymentConfiguration(): Promise<ProductionCheck[]> {
    const checks: ProductionCheck[] = [];

    try {
      // Check payment transactions table
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('id')
        .limit(1);
      
      if (error) {
        checks.push({
          name: 'Payment System',
          status: 'fail',
          message: `Payment system access failed: ${error.message}`
        });
      } else {
        checks.push({
          name: 'Payment System',
          status: 'pass',
          message: 'Payment system is accessible'
        });
      }

    } catch (error) {
      checks.push({
        name: 'Payment Configuration',
        status: 'fail',
        message: `Failed to access payment configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return checks;
  }

  static async validateOrderSystem(): Promise<ProductionCheck[]> {
    const checks: ProductionCheck[] = [];

    try {
      // Test order management components
      const { data, error } = await supabase.from('orders_view').select('id').limit(1);
      
      if (error) {
        checks.push({
          name: 'Order System',
          status: 'fail',
          message: `Order system failed: ${error.message}`
        });
      } else {
        checks.push({
          name: 'Order System',
          status: 'pass',
          message: 'Order system is healthy'
        });
      }

      // Test audit logging
      const { data: auditData, error: auditError } = await supabase
        .from('order_audit_log')
        .select('id')
        .limit(1);

      if (auditError) {
        checks.push({
          name: 'Order Audit System',
          status: 'warning',
          message: 'Order audit logging may not be configured'
        });
      } else {
        checks.push({
          name: 'Order Audit System',
          status: 'pass',
          message: 'Order audit logging is configured'
        });
      }

    } catch (error) {
      checks.push({
        name: 'Order System Health',
        status: 'fail',
        message: `Order system health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return checks;
  }

  static async performFullCheck(): Promise<ProductionReadiness> {
    const databaseChecks = await this.validateDatabaseHealth();
    const paymentChecks = await this.validatePaymentConfiguration();
    const orderChecks = await this.validateOrderSystem();
    const allChecks = [...databaseChecks, ...paymentChecks, ...orderChecks];

    const passCount = allChecks.filter(check => check.status === 'pass').length;
    const failCount = allChecks.filter(check => check.status === 'fail').length;
    const warningCount = allChecks.filter(check => check.status === 'warning').length;

    const score = Math.round((passCount / allChecks.length) * 100);
    const isReady = failCount === 0 && score >= 80;

    const criticalIssues = allChecks
      .filter(check => check.status === 'fail')
      .map(check => check.message);

    const warnings = allChecks
      .filter(check => check.status === 'warning')
      .map(check => check.message);

    return {
      isReady,
      score,
      checks: allChecks,
      criticalIssues,
      warnings
    };
  }
}
