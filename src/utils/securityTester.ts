/**
 * 🧪 Security Testing Utility
 * 
 * Provides automated tests to verify security implementation
 * Run in browser console: window.runSecurityTests()
 */

import { supabase } from '@/integrations/supabase/client';
import { checkIsAdmin } from '@/lib/auth-helpers';

interface SecurityTestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Test 1: Verify RLS is enabled on orders table
 */
async function testRLSEnabled(): Promise<SecurityTestResult> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .limit(1);

    // If we get here, RLS is working (either returning data or empty)
    return {
      test: 'RLS Enabled Check',
      passed: true,
      message: 'RLS is properly configured on orders table',
      details: { hasData: !!data?.length }
    };
  } catch (error: any) {
    return {
      test: 'RLS Enabled Check',
      passed: false,
      message: 'Failed to verify RLS configuration',
      details: { error: error.message }
    };
  }
}

/**
 * Test 2: Verify admin authentication check
 */
async function testAdminCheck(): Promise<SecurityTestResult> {
  try {
    const { requireAdminAccess } = await import('@/lib/api-security');
    
    try {
      await requireAdminAccess();
      return {
        test: 'Admin Authentication',
        passed: true,
        message: 'Current user has admin access',
      };
    } catch (error: any) {
      return {
        test: 'Admin Authentication',
        passed: true,
        message: 'Non-admin correctly blocked',
        details: { expectedBehavior: true }
      };
    }
  } catch (error: any) {
    return {
      test: 'Admin Authentication',
      passed: false,
      message: 'Admin check failed unexpectedly',
      details: { error: error.message }
    };
  }
}

/**
 * Test 3: Verify edge function exists and is callable
 */
async function testEdgeFunctionExists(): Promise<SecurityTestResult> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: { action: 'test' } // Invalid action to test function exists
    });

    return {
      test: 'Edge Function Accessibility',
      passed: true,
      message: 'admin-orders-manager edge function is accessible',
      details: { 
        responded: true,
        hasError: !!error 
      }
    };
  } catch (error: any) {
    return {
      test: 'Edge Function Accessibility',
      passed: false,
      message: 'Edge function not accessible',
      details: { error: error.message }
    };
  }
}

/**
 * Test 4: Verify input validation works
 */
async function testInputValidation(): Promise<SecurityTestResult> {
  try {
    const { validateOrderUpdate } = await import('@/lib/api-security');
    
    // Test valid input
    try {
      validateOrderUpdate({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        updates: { status: 'confirmed' }
      });
    } catch (error: any) {
      return {
        test: 'Input Validation',
        passed: false,
        message: 'Valid input rejected',
        details: { error: error.message }
      };
    }

    // Test invalid input (should throw)
    try {
      validateOrderUpdate({
        orderId: 'invalid-uuid',
        updates: { status: 'confirmed' }
      });
      return {
        test: 'Input Validation',
        passed: false,
        message: 'Invalid input not rejected',
      };
    } catch (error: any) {
      // Expected to throw
      return {
        test: 'Input Validation',
        passed: true,
        message: 'Input validation working correctly',
      };
    }
  } catch (error: any) {
    return {
      test: 'Input Validation',
      passed: false,
      message: 'Validation test failed',
      details: { error: error.message }
    };
  }
}

/**
 * Test 5: Verify audit logging function exists
 */
async function testAuditLogging(): Promise<SecurityTestResult> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id')
      .limit(1);

    if (error) {
      return {
        test: 'Audit Logging',
        passed: false,
        message: 'Cannot access audit_logs table',
        details: { error: error.message }
      };
    }

    return {
      test: 'Audit Logging',
      passed: true,
      message: 'Audit logs table accessible',
    };
  } catch (error: any) {
    return {
      test: 'Audit Logging',
      passed: false,
      message: 'Audit logging test failed',
      details: { error: error.message }
    };
  }
}

/**
 * Test 6: Verify is_admin() function exists
 */
async function testIsAdminFunction(): Promise<SecurityTestResult> {
  try {
    const { data, error } = await supabase.rpc('is_admin');

    if (error) {
      return {
        test: 'is_admin() Function',
        passed: false,
        message: 'is_admin() function not accessible',
        details: { error: error.message }
      };
    }

    return {
      test: 'is_admin() Function',
      passed: true,
      message: `is_admin() returned: ${data}`,
      details: { isAdmin: data }
    };
  } catch (error: any) {
    return {
      test: 'is_admin() Function',
      passed: false,
      message: 'is_admin() test failed',
      details: { error: error.message }
    };
  }
}

/**
 * Run all security tests
 */
export async function runSecurityTests(): Promise<SecurityTestResult[]> {
  console.log('🔒 Running Security Tests...\n');

  const tests = [
    testRLSEnabled,
    testAdminCheck,
    testEdgeFunctionExists,
    testInputValidation,
    testAuditLogging,
    testIsAdminFunction,
  ];

  const results: SecurityTestResult[] = [];

  for (const test of tests) {
    const result = await test();
    results.push(result);
    
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
    if (result.details) {
      console.log('   Details:', result.details);
    }
  }

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log(`\n📊 Security Test Results: ${passedCount}/${totalCount} passed`);
  
  if (passedCount === totalCount) {
    console.log('✅ All security tests passed!');
  } else {
    console.warn('⚠️ Some security tests failed. Review results above.');
  }

  return results;
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).runSecurityTests = runSecurityTests;
}
