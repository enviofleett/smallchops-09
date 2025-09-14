/**
 * Payment System Diagnostics and Validation
 * Quick checks for payment system health and common issues
 */

import { supabase } from '@/integrations/supabase/client';
import { safeErrorMessage } from './errorHandling';

export interface DiagnosticResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

/**
 * Comprehensive payment system validation
 */
export const validatePaymentFlow = async (): Promise<DiagnosticResult[]> => {
  const results: DiagnosticResult[] = [];
  
  try {
    console.log('🧪 Running payment system diagnostics...');
    
    // Test 1: Verify business settings
    try {
      const { data: settings, error } = await supabase
        .from('business_settings')
        .select('allow_guest_checkout')
        .single();
      
      if (error) {
        results.push({
          category: 'Configuration',
          check: 'Business Settings',
          status: 'fail',
          message: 'Could not fetch business settings',
          details: { error: safeErrorMessage(error) }
        });
      } else {
        results.push({
          category: 'Configuration',
          check: 'Business Settings',
          status: 'pass',
          message: `Guest checkout: ${settings?.allow_guest_checkout ? 'enabled' : 'disabled'}`,
          details: settings
        });
      }
    } catch (error) {
      results.push({
        category: 'Configuration',
        check: 'Business Settings',
        status: 'fail',
        message: 'Business settings check failed',
        details: { error: safeErrorMessage(error) }
      });
    }
    
    // Test 2: Check recent payment transactions format
    try {
      const { data: transactions, error } = await supabase
        .from('payment_transactions')
        .select('provider_reference, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        results.push({
          category: 'Data Integrity',
          check: 'Payment Transactions',
          status: 'fail',
          message: 'Could not fetch payment transactions',
          details: { error: safeErrorMessage(error) }
        });
      } else {
        const hasCorrectFormat = transactions?.every(t => 
          t.provider_reference && t.provider_reference.startsWith('txn_')
        ) ?? false;
        
        results.push({
          category: 'Data Integrity',
          check: 'Transaction Reference Format',
          status: hasCorrectFormat ? 'pass' : 'warning',
          message: hasCorrectFormat 
            ? 'All recent references use txn_ format'
            : 'Some references may use legacy format',
          details: { 
            totalChecked: transactions?.length || 0,
            correctFormat: hasCorrectFormat,
            samples: transactions?.slice(0, 3)?.map(t => ({ 
              reference: t.provider_reference, 
              status: t.status 
            }))
          }
        });
      }
    } catch (error) {
      results.push({
        category: 'Data Integrity',
        check: 'Payment Transactions',
        status: 'fail',
        message: 'Transaction format check failed',
        details: { error: safeErrorMessage(error) }
      });
    }
    
    // Test 3: Check orders payment_reference format
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, payment_reference, status')
        .not('payment_reference', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        results.push({
          category: 'Data Integrity',
          check: 'Order References',
          status: 'fail',
          message: 'Could not fetch order references',
          details: { error: safeErrorMessage(error) }
        });
      } else {
        const ordersWithReferences = orders?.length || 0;
        
        results.push({
          category: 'Data Integrity',
          check: 'Order Payment References',
          status: ordersWithReferences > 0 ? 'pass' : 'warning',
          message: `Found ${ordersWithReferences} orders with payment references`,
          details: { 
            ordersFound: ordersWithReferences,
            samples: orders?.slice(0, 3)?.map(o => ({ 
              id: o.id, 
              reference: o.payment_reference, 
              status: o.status 
            }))
          }
        });
      }
    } catch (error) {
      results.push({
        category: 'Data Integrity',
        check: 'Order References',
        status: 'fail',
        message: 'Order reference check failed',
        details: { error: safeErrorMessage(error) }
      });
    }
    
    // Test 4: Test edge function connectivity
    try {
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'health-check' }
      });
      
      if (error) {
        results.push({
          category: 'Connectivity',
          check: 'Edge Functions',
          status: 'fail',
          message: 'Edge function connectivity failed',
          details: { error: safeErrorMessage(error) }
        });
      } else {
        results.push({
          category: 'Connectivity',
          check: 'Edge Functions',
          status: 'pass',
          message: 'Edge function connectivity verified',
          details: { response: data }
        });
      }
    } catch (error) {
      results.push({
        category: 'Connectivity',
        check: 'Edge Functions',
        status: 'warning',
        message: 'Edge function test inconclusive',
        details: { error: safeErrorMessage(error) }
      });
    }
    
    console.log('✅ Payment diagnostics completed');
    return results;
    
  } catch (error) {
    console.error('❌ Diagnostic validation failed:', error);
    return [{
      category: 'System',
      check: 'Diagnostic System',
      status: 'fail',
      message: 'Diagnostic system encountered an error',
      details: { error: safeErrorMessage(error) }
    }];
  }
};

/**
 * Quick payment system health check
 */
export const quickHealthCheck = async (): Promise<boolean> => {
  try {
    const results = await validatePaymentFlow();
    const criticalFailures = results.filter(r => r.status === 'fail' && r.category !== 'Connectivity');
    return criticalFailures.length === 0;
  } catch (error) {
    console.error('Quick health check failed:', error);
    return false;
  }
};

/**
 * Format diagnostic results for display
 */
export const formatDiagnosticResults = (results: DiagnosticResult[]): string => {
  const sections = results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, DiagnosticResult[]>);
  
  let output = '🔍 Payment System Diagnostics\n\n';
  
  Object.entries(sections).forEach(([category, checks]) => {
    output += `## ${category}\n`;
    checks.forEach(check => {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      output += `${icon} ${check.check}: ${check.message}\n`;
    });
    output += '\n';
  });
  
  return output;
};