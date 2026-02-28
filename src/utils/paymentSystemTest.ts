import { supabase } from '@/integrations/supabase/client';

export interface PaymentSystemTestResult {
  healthCheck: any;
  migrationStatus: any;
  credentialTest: any;
  success: boolean;
  message: string;
}

export class PaymentSystemTester {
  
  /**
   * Run comprehensive payment system tests
   */
  static async runFullTest(): Promise<PaymentSystemTestResult> {
    console.log('🧪 Starting comprehensive payment system test');
    
    try {
      // 1. Run health diagnostic
      const healthCheck = await this.runHealthDiagnostic();
      console.log('✅ Health diagnostic completed');
      
      // 2. Check migration status
      const migrationStatus = await this.checkMigrationStatus();
      console.log('✅ Migration status checked');
      
      // 3. Test Paystack credentials
      const credentialTest = await this.testPaystackCredentials();
      console.log('✅ Credential test completed');
      
      // 4. Check for critical issues
      const hasCriticalIssues = healthCheck.health_checks?.some(
        (check: any) => check.status === 'critical'
      );
      
      const needsMigration = migrationStatus.status?.pay_references > 0;
      
      let message = '✅ Payment system is operational';
      if (hasCriticalIssues) {
        message = '❌ Critical issues detected in payment system';
      } else if (needsMigration) {
        message = '⚠️ Migration needed for legacy references';
      }
      
      return {
        healthCheck,
        migrationStatus,
        credentialTest,
        success: !hasCriticalIssues,
        message
      };
      
    } catch (error) {
      console.error('❌ Payment system test failed:', error);
      return {
        healthCheck: null,
        migrationStatus: null,
        credentialTest: null,
        success: false,
        message: `Test failed: ${error.message}`
      };
    }
  }
  
  /**
   * Run payment system health diagnostic
   */
  static async runHealthDiagnostic() {
    try {
      const { data, error } = await supabase.functions.invoke('payment-health-diagnostic');
      
      if (error) {
        throw new Error(`Health diagnostic failed: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('Health diagnostic error:', error);
      throw error;
    }
  }
  
  /**
   * Check migration status
   */
  static async checkMigrationStatus() {
    try {
      const { data, error } = await supabase.functions.invoke('payment-recovery', {
        body: { action: 'recovery_status' }
      });
      
      if (error) {
        throw new Error(`Migration status check failed: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('Migration status error:', error);
      throw error;
    }
  }
  
  /**
   * Test Paystack credentials
   */
  static async testPaystackCredentials() {
    try {
      const { data, error } = await supabase.functions.invoke('test-paystack-credentials');
      
      if (error) {
        throw new Error(`Credential test failed: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('Credential test error:', error);
      throw error;
    }
  }
  
  /**
   * Run migration for legacy references
   */
  static async runMigration() {
    try {
      console.log('🔄 Starting reference migration');
      
      const { data, error } = await supabase.functions.invoke('payment-recovery', {
        body: { action: 'migrate_references' }
      });
      
      if (error) {
        throw new Error(`Migration failed: ${error.message}`);
      }
      
      console.log('✅ Migration completed:', data);
      return data;
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }
  
  /**
   * Create missing payment transaction records
   */
  static async createMissingTransactions() {
    try {
      console.log('💾 Creating missing transaction records');
      
      const { data, error } = await supabase.functions.invoke('payment-recovery', {
        body: { action: 'create_missing_transactions' }
      });
      
      if (error) {
        throw new Error(`Transaction creation failed: ${error.message}`);
      }
      
      console.log('✅ Transaction creation completed:', data);
      return data;
    } catch (error) {
      console.error('Transaction creation error:', error);
      throw error;
    }
  }
}

// Helper function to format test results for display
export function formatTestResults(results: PaymentSystemTestResult): string {
  const lines = [
    `Payment System Test Results`,
    `================================`,
    `Status: ${results.success ? '✅ PASS' : '❌ FAIL'}`,
    `Message: ${results.message}`,
    ``,
  ];
  
  if (results.healthCheck) {
    lines.push(`Health Check Summary:`);
    lines.push(`- Overall Status: ${results.healthCheck.overall_status}`);
    lines.push(`- Health Checks: ${results.healthCheck.summary?.healthy || 0} healthy, ${results.healthCheck.summary?.warnings || 0} warnings, ${results.healthCheck.summary?.critical || 0} critical`);
    lines.push(``);
  }
  
  if (results.migrationStatus) {
    lines.push(`Migration Status:`);
    lines.push(`- Legacy pay_ references: ${results.migrationStatus.status?.pay_references || 0}`);
    lines.push(`- Modern txn_ references: ${results.migrationStatus.status?.txn_references || 0}`);
    lines.push(`- Pending orders: ${results.migrationStatus.status?.pending_orders || 0}`);
    lines.push(`- Migration needed: ${results.migrationStatus.status?.migration_needed ? 'Yes' : 'No'}`);
    lines.push(``);
  }
  
  if (results.credentialTest) {
    lines.push(`Credential Test:`);
    lines.push(`- API Connectivity: ${results.credentialTest.api_test?.success ? '✅' : '❌'}`);
    lines.push(`- Key Format: ${results.credentialTest.key_validation?.valid ? '✅' : '❌'}`);
    lines.push(``);
  }
  
  return lines.join('\n');
}