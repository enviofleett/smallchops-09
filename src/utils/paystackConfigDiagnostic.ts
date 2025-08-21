// Paystack Configuration Diagnostic Tool
// Helps diagnose and fix payment system configuration issues

import { supabase } from '@/integrations/supabase/client';

export interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  recommendation?: string;
  details?: any;
}

export interface ConfigDiagnostic {
  overall_status: 'healthy' | 'critical' | 'warning';
  issues_found: string[];
  recommendations: string[];
  tests: DiagnosticResult[];
}

export const diagnosePaystackConfiguration = async (): Promise<ConfigDiagnostic> => {
  const tests: DiagnosticResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  console.log('🔍 Starting Paystack configuration diagnostic...');

  // Test 1: Check environment variables availability
  try {
    const envTest = await testEnvironmentVariables();
    tests.push(envTest);
    if (envTest.status === 'fail') {
      issues.push('Environment variables not configured');
      recommendations.push('Set PAYSTACK_SECRET_KEY environment variable in Supabase Functions');
    }
  } catch (error) {
    tests.push({
      name: 'Environment Variables Check',
      status: 'fail',
      message: `Failed to check environment: ${error.message}`
    });
    issues.push('Environment check failed');
  }

  // Test 2: Test Paystack API connectivity
  try {
    const apiTest = await testPaystackApiConnectivity();
    tests.push(apiTest);
    if (apiTest.status === 'fail') {
      issues.push('Paystack API connectivity failed');
      recommendations.push('Check Paystack secret key and network connectivity');
    }
  } catch (error) {
    tests.push({
      name: 'Paystack API Connectivity',
      status: 'fail',
      message: `API test failed: ${error.message}`
    });
    issues.push('API connectivity failed');
  }

  // Test 3: Test payment initialization flow
  try {
    const initTest = await testPaymentInitialization();
    tests.push(initTest);
    if (initTest.status === 'fail') {
      issues.push('Payment initialization failed');
      recommendations.push('Check paystack-secure function configuration and Paystack credentials');
    }
  } catch (error) {
    tests.push({
      name: 'Payment Initialization Test',
      status: 'fail',
      message: `Initialization test failed: ${error.message}`
    });
    issues.push('Payment initialization failed');
  }

  // Test 4: Check database configuration
  try {
    const dbTest = await testDatabaseConfiguration();
    tests.push(dbTest);
    if (dbTest.status === 'fail') {
      issues.push('Database configuration issues');
      recommendations.push('Check payment_integrations table and required columns');
    }
  } catch (error) {
    tests.push({
      name: 'Database Configuration',
      status: 'fail',
      message: `Database test failed: ${error.message}`
    });
    issues.push('Database configuration failed');
  }

  // Determine overall status
  const criticalFailures = tests.filter(t => t.status === 'fail').length;
  const warnings = tests.filter(t => t.status === 'warning').length;
  
  let overall_status: 'healthy' | 'critical' | 'warning' = 'healthy';
  if (criticalFailures > 0) {
    overall_status = 'critical';
  } else if (warnings > 0) {
    overall_status = 'warning';
  }

  return {
    overall_status,
    issues_found: issues,
    recommendations,
    tests
  };
};

// Test environment variables
const testEnvironmentVariables = async (): Promise<DiagnosticResult> => {
  try {
    // Call a diagnostic function to check environment variables
    const { data, error } = await supabase.functions.invoke('payment-health-diagnostic');
    
    if (error) {
      return {
        name: 'Environment Variables Check',
        status: 'fail',
        message: `Failed to check environment: ${error.message}`,
        recommendation: 'Ensure Supabase Functions have access to PAYSTACK_SECRET_KEY'
      };
    }

    // Check if Paystack configuration is present
    const hasPaystackConfig = data?.healthChecks?.some((check: any) => 
      check.component === 'Paystack Configuration' && check.status === 'healthy'
    );

    if (hasPaystackConfig) {
      return {
        name: 'Environment Variables Check',
        status: 'pass',
        message: 'Paystack environment variables are properly configured'
      };
    } else {
      return {
        name: 'Environment Variables Check',
        status: 'fail',
        message: 'Paystack secret key not found or invalid',
        recommendation: 'Set PAYSTACK_SECRET_KEY environment variable in Supabase Functions'
      };
    }
  } catch (error) {
    return {
      name: 'Environment Variables Check',
      status: 'fail',
      message: `Environment check failed: ${error.message}`,
      recommendation: 'Check Supabase Functions environment configuration'
    };
  }
};

// Test Paystack API connectivity
const testPaystackApiConnectivity = async (): Promise<DiagnosticResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('payment-health-diagnostic');
    
    if (error) {
      return {
        name: 'Paystack API Connectivity',
        status: 'fail',
        message: `API connectivity test failed: ${error.message}`,
        recommendation: 'Check network connectivity and Paystack service status'
      };
    }

    const apiConnectivity = data?.healthChecks?.find((check: any) => 
      check.component === 'Paystack API Connectivity'
    );

    if (apiConnectivity?.status === 'healthy') {
      return {
        name: 'Paystack API Connectivity',
        status: 'pass',
        message: 'Paystack API is reachable and responding correctly'
      };
    } else {
      return {
        name: 'Paystack API Connectivity',
        status: 'fail',
        message: apiConnectivity?.message || 'Paystack API is not responding correctly',
        recommendation: 'Check Paystack secret key validity and API status'
      };
    }
  } catch (error) {
    return {
      name: 'Paystack API Connectivity',
      status: 'fail',
      message: `API connectivity test failed: ${error.message}`,
      recommendation: 'Verify network connectivity and Paystack API credentials'
    };
  }
};

// Test payment initialization flow
const testPaymentInitialization = async (): Promise<DiagnosticResult> => {
  try {
    const testPayload = {
      action: 'initialize',
      email: 'test@example.com',
      amount: 1000, // 10 NGN
      reference: `test_${Date.now()}`,
      metadata: {
        test: true,
        description: 'Configuration test transaction'
      }
    };

    const { data, error } = await supabase.functions.invoke('paystack-secure', {
      body: testPayload
    });

    if (error) {
      return {
        name: 'Payment Initialization Test',
        status: 'fail',
        message: `Payment initialization failed: ${error.message}`,
        recommendation: 'Check paystack-secure function configuration and environment variables'
      };
    }

    if (data?.status && data?.data?.authorization_url) {
      return {
        name: 'Payment Initialization Test',
        status: 'pass',
        message: 'Payment initialization working correctly',
        details: {
          reference: data.data.reference,
          hasAuthUrl: !!data.data.authorization_url,
          hasAccessCode: !!data.data.access_code
        }
      };
    } else {
      return {
        name: 'Payment Initialization Test',
        status: 'fail',
        message: 'Payment initialization returned invalid response',
        recommendation: 'Check Paystack credentials and configuration',
        details: data
      };
    }
  } catch (error) {
    return {
      name: 'Payment Initialization Test',
      status: 'fail',
      message: `Payment test failed: ${error.message}`,
      recommendation: 'Check function availability and configuration'
    };
  }
};

// Test database configuration
const testDatabaseConfiguration = async (): Promise<DiagnosticResult> => {
  try {
    // Check if required tables exist and have proper structure
    const { data: paymentIntegrations, error: piError } = await supabase
      .from('payment_integrations')
      .select('*')
      .limit(1);

    if (piError) {
      return {
        name: 'Database Configuration',
        status: 'fail',
        message: `Payment integrations table error: ${piError.message}`,
        recommendation: 'Ensure payment_integrations table exists and has proper RLS policies'
      };
    }

    // Check payment_transactions table
    const { data: paymentTransactions, error: ptError } = await supabase
      .from('payment_transactions')
      .select('reference')
      .limit(1);

    if (ptError) {
      return {
        name: 'Database Configuration',
        status: 'warning',
        message: `Payment transactions table warning: ${ptError.message}`,
        recommendation: 'Check payment_transactions table permissions'
      };
    }

    return {
      name: 'Database Configuration',
      status: 'pass',
      message: 'Database tables are properly configured'
    };
  } catch (error) {
    return {
      name: 'Database Configuration',
      status: 'fail',
      message: `Database configuration test failed: ${error.message}`,
      recommendation: 'Check database connectivity and table structure'
    };
  }
};

// Quick diagnostic for immediate issues
export const quickPaystackDiagnostic = async (): Promise<string[]> => {
  const issues: string[] = [];

  try {
    // Test basic function availability
    const { error } = await supabase.functions.invoke('paystack-secure', {
      body: { test: true }
    });

    if (error) {
      if (error.message.includes('secret key')) {
        issues.push('🔑 Paystack secret key not configured');
      }
      if (error.message.includes('network') || error.message.includes('fetch')) {
        issues.push('🌐 Network connectivity issue');
      }
      if (error.message.includes('function')) {
        issues.push('⚙️ Function configuration issue');
      }
      if (!issues.length) {
        issues.push(`❌ Unknown error: ${error.message}`);
      }
    }
  } catch (error) {
    issues.push(`🚨 Critical error: ${error.message}`);
  }

  return issues;
};

// Auto-fix common issues
export const autoFixPaystackConfig = async (): Promise<{
  fixed: string[];
  stillBroken: string[];
  recommendations: string[];
}> => {
  const fixed: string[] = [];
  const stillBroken: string[] = [];
  const recommendations: string[] = [];

  // Run diagnostic first
  const diagnostic = await diagnosePaystackConfiguration();

  // Check if we can auto-fix any issues
  if (diagnostic.issues_found.includes('Environment variables not configured')) {
    recommendations.push('Manual action required: Set PAYSTACK_SECRET_KEY in Supabase Functions environment');
    stillBroken.push('Environment variables not configured');
  }

  if (diagnostic.issues_found.includes('Paystack API connectivity failed')) {
    recommendations.push('Check Paystack secret key validity and network connectivity');
    stillBroken.push('API connectivity failed');
  }

  if (diagnostic.issues_found.includes('Payment initialization failed')) {
    recommendations.push('Verify paystack-secure function is deployed and configured correctly');
    stillBroken.push('Payment initialization failed');
  }

  return {
    fixed,
    stillBroken,
    recommendations
  };
};
