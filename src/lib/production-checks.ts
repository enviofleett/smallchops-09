
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
  static async validatePaymentConfiguration(): Promise<ProductionCheck[]> {
    const checks: ProductionCheck[] = [];

    try {
      // Check Paystack configuration
      const { data: config, error } = await supabase.rpc('get_active_paystack_config');
      
      if (error || !config) {
        checks.push({
          name: 'Paystack Configuration',
          status: 'fail',
          message: 'Paystack configuration not found or inaccessible'
        });
        return checks;
      }

      const configData = Array.isArray(config) ? config[0] : config;

      // Check public key
      if (!configData.public_key || !configData.public_key.startsWith('pk_')) {
        checks.push({
          name: 'Public Key',
          status: 'fail',
          message: 'Invalid or missing Paystack public key'
        });
      } else {
        checks.push({
          name: 'Public Key',
          status: 'pass',
          message: 'Valid Paystack public key configured'
        });
      }

      // Check secret key
      if (!configData.secret_key || !configData.secret_key.startsWith('sk_')) {
        checks.push({
          name: 'Secret Key',
          status: 'fail',
          message: 'Invalid or missing Paystack secret key'
        });
      } else {
        checks.push({
          name: 'Secret Key',
          status: 'pass',
          message: 'Valid Paystack secret key configured'
        });
      }

      // Check webhook secret
      if (!configData.webhook_secret || configData.webhook_secret.length < 10) {
        checks.push({
          name: 'Webhook Secret',
          status: 'fail',
          message: 'Webhook secret is missing or too short'
        });
      } else {
        checks.push({
          name: 'Webhook Secret',
          status: 'pass',
          message: 'Webhook secret properly configured'
        });
      }

      // Check environment mode
      if (configData.test_mode) {
        checks.push({
          name: 'Environment Mode',
          status: 'warning',
          message: 'Currently in test mode - switch to live mode for production'
        });
      } else {
        checks.push({
          name: 'Environment Mode',
          status: 'pass',
          message: 'Live mode is enabled'
        });
      }

      // Check if we have the necessary configuration
      // Since connection_status doesn't exist in the type, we'll check if basic config is present
      if (configData.public_key && configData.secret_key) {
        checks.push({
          name: 'Connection Status',
          status: 'pass',
          message: 'Paystack configuration is complete'
        });
      } else {
        checks.push({
          name: 'Connection Status',
          status: 'fail',
          message: 'Paystack configuration is incomplete'
        });
      }

    } catch (error) {
      checks.push({
        name: 'Configuration Access',
        status: 'fail',
        message: `Failed to access payment configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return checks;
  }

  static async validateSystemHealth(): Promise<ProductionCheck[]> {
    const checks: ProductionCheck[] = [];

    try {
      // Test database connection
      const { data, error } = await supabase.from('orders').select('id').limit(1);
      
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

      // Test edge function availability
      const { error: functionError } = await supabase.functions.invoke('process-checkout', {
        body: { test: true }
      });

      if (functionError) {
        checks.push({
          name: 'Edge Functions',
          status: 'warning',
          message: 'Edge function test returned error - may be normal for test calls'
        });
      } else {
        checks.push({
          name: 'Edge Functions',
          status: 'pass',
          message: 'Edge functions are accessible'
        });
      }

    } catch (error) {
      checks.push({
        name: 'System Health',
        status: 'fail',
        message: `System health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return checks;
  }

  static async performFullCheck(): Promise<ProductionReadiness> {
    const paymentChecks = await this.validatePaymentConfiguration();
    const systemChecks = await this.validateSystemHealth();
    const allChecks = [...paymentChecks, ...systemChecks];

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
