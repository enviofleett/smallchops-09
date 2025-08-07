import { PaymentValidationResult, validatePaymentInitializationData } from './paymentDataValidator';

export interface PaymentDebugInfo {
  timestamp: string;
  checkoutData: any;
  responseData: any;
  validationResult: PaymentValidationResult;
  issues: string[];
  recommendations: string[];
}

/**
 * Comprehensive payment initialization debugger
 */
export function debugPaymentInitialization(checkoutData: any, responseData: any): PaymentDebugInfo {
  const timestamp = new Date().toISOString();
  const issues: string[] = [];
  const recommendations: string[] = [];

  console.group('🔧 Payment Initialization Debug Session');
  console.log('🕒 Timestamp:', timestamp);
  
  // Log input data
  console.group('📤 Input Data Analysis');
  console.log('📋 Checkout Data Structure:', {
    hasCustomerEmail: !!checkoutData?.customer_email,
    hasCustomerName: !!checkoutData?.customer_name,
    hasOrderItems: Array.isArray(checkoutData?.order_items),
    itemCount: checkoutData?.order_items?.length || 0,
    totalAmount: checkoutData?.total_amount,
    fulfillmentType: checkoutData?.fulfillment_type,
    paymentMethod: checkoutData?.payment_method,
    hasPaymentReference: !!checkoutData?.payment_reference
  });

  // Detailed checkout data logging
  console.log('📊 Full Checkout Data:', JSON.stringify(checkoutData, null, 2));

  // Validate checkout data integrity
  if (!checkoutData?.customer_email) {
    issues.push('Customer email is missing from checkout data');
    recommendations.push('Ensure customer email is captured before checkout');
  }

  if (!checkoutData?.order_items || checkoutData.order_items.length === 0) {
    issues.push('No order items found in checkout data');
    recommendations.push('Verify cart has items before initiating checkout');
  }

  if (typeof checkoutData?.total_amount !== 'number' || checkoutData.total_amount <= 0) {
    issues.push('Invalid total amount in checkout data');
    recommendations.push('Recalculate cart total before checkout');
  }

  console.groupEnd(); // Input Data Analysis

  // Log response data
  console.group('📥 Response Data Analysis');
  console.log('🔍 Response Structure:', {
    dataType: typeof responseData,
    isNull: responseData === null,
    isUndefined: responseData === undefined,
    hasSuccess: 'success' in (responseData || {}),
    successValue: responseData?.success,
    hasPayment: 'payment' in (responseData || {}),
    hasOrderNumber: 'order_number' in (responseData || {}),
    hasTotalAmount: 'total_amount' in (responseData || {})
  });

  // Log full response for debugging
  console.log('📊 Full Response Data:', JSON.stringify(responseData, null, 2));

  // Check response data issues
  if (!responseData) {
    issues.push('Response data is null or undefined');
    recommendations.push('Check edge function logs for errors');
    recommendations.push('Verify Supabase function invocation');
  } else if (typeof responseData === 'string') {
    issues.push('Response data is a string instead of object');
    recommendations.push('Check if response needs JSON parsing');
    try {
      const parsed = JSON.parse(responseData);
      console.log('📝 Parsed Response:', parsed);
    } catch (e) {
      issues.push('Response string is not valid JSON');
    }
  }

  console.groupEnd(); // Response Data Analysis

  // Validate payment data
  console.group('✅ Payment Validation');
  const validationResult = validatePaymentInitializationData(responseData);
  
  console.log('🎯 Validation Summary:', {
    isValid: validationResult.isValid,
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
    missingFieldCount: validationResult.missingFields.length
  });

  if (!validationResult.isValid) {
    issues.push(...validationResult.errors);
    
    validationResult.missingFields.forEach(field => {
      recommendations.push(`Add ${field} to the response data`);
    });

    validationResult.warnings.forEach(warning => {
      recommendations.push(`Consider: ${warning}`);
    });
  }

  console.groupEnd(); // Payment Validation

  // Network and timing analysis
  console.group('🌐 Network & Timing Analysis');
  const networkChecks = {
    paymentReference: checkoutData?.payment_reference,
    requestTimestamp: checkoutData?.timestamp || 'Not recorded',
    responseReceived: !!responseData,
    responseSize: JSON.stringify(responseData || {}).length
  };
  
  console.log('📡 Network Details:', networkChecks);

  if (!checkoutData?.payment_reference) {
    issues.push('No payment reference generated for tracking');
    recommendations.push('Generate unique payment reference before API call');
  }

  console.groupEnd(); // Network & Timing Analysis

  // Paystack-specific analysis
  console.group('💳 Paystack Integration Analysis');
  const paystackChecks = {
    hasAuthorizationUrl: !!responseData?.payment?.authorization_url,
    hasPaymentUrl: !!responseData?.payment?.payment_url,
    hasReference: !!responseData?.payment?.reference,
    referenceMatches: responseData?.payment?.reference === checkoutData?.payment_reference
  };

  console.log('🏦 Paystack Response Structure:', paystackChecks);

  // Check for common Paystack issues
  if (responseData?.payment?.authorization_url && !responseData?.payment?.payment_url) {
    issues.push('Paystack returned authorization_url but frontend expects payment_url');
    recommendations.push('Update frontend to handle authorization_url or normalize the response');
  }

  if (responseData?.payment?.reference !== checkoutData?.payment_reference) {
    issues.push('Payment reference mismatch between request and response');
    recommendations.push('Verify reference generation and passing');
  }

  console.groupEnd(); // Paystack Integration Analysis

  // Configuration analysis
  console.group('⚙️ Configuration Analysis');
  const configChecks = {
    environment: process.env.NODE_ENV,
    hasPaystackConfig: 'Checking...', // This would need to be passed in if needed
    timestamp: new Date().toISOString()
  };

  console.log('🔧 Environment Configuration:', configChecks);
  console.groupEnd(); // Configuration Analysis

  // Summary and next steps
  console.group('📋 Debug Summary');
  console.log('🚨 Issues Found:', issues);
  console.log('💡 Recommendations:', recommendations);
  
  if (issues.length === 0) {
    console.log('✅ No critical issues detected');
  } else {
    console.log(`❌ ${issues.length} issues need attention`);
  }

  console.groupEnd(); // Debug Summary
  console.groupEnd(); // Payment Initialization Debug Session

  return {
    timestamp,
    checkoutData,
    responseData,
    validationResult,
    issues,
    recommendations
  };
}

/**
 * Quick diagnostic function for immediate issue identification
 */
export function quickPaymentDiagnostic(responseData: any): { issue: string; fix: string } | null {
  if (!responseData) {
    return {
      issue: 'No response data received',
      fix: 'Check edge function logs and network connectivity'
    };
  }

  if (responseData.success !== true) {
    return {
      issue: 'API call failed',
      fix: responseData.message || responseData.error || 'Check edge function for specific error'
    };
  }

  if (!responseData.payment) {
    return {
      issue: 'Payment object missing',
      fix: 'Verify Paystack integration and configuration'
    };
  }

  if (!responseData.payment.payment_url && !responseData.payment.authorization_url) {
    return {
      issue: 'No payment URL in response',
      fix: 'Check Paystack API response and ensure proper URL extraction'
    };
  }

  if (responseData.payment.authorization_url && !responseData.payment.payment_url) {
    return {
      issue: 'Frontend expects payment_url but got authorization_url',
      fix: 'Normalize response to use authorization_url as payment_url'
    };
  }

  return null; // No obvious issues
}

/**
 * Log payment attempt for monitoring and analytics
 */
export function logPaymentAttempt(checkoutData: any, result: 'success' | 'failure' | 'attempt', details?: any): void {
  const logData = {
    timestamp: new Date().toISOString(),
    result,
    amount: checkoutData?.total_amount,
    customerEmail: checkoutData?.customer_email,
    paymentReference: checkoutData?.payment_reference,
    fulfillmentType: checkoutData?.fulfillment_type,
    itemCount: checkoutData?.order_items?.length,
    details
  };

  console.log('📊 Payment Attempt Log:', logData);
  
  // In a real application, you might send this to an analytics service
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'payment_attempt', {
      custom_parameter_1: result,
      custom_parameter_2: checkoutData?.total_amount,
      custom_parameter_3: checkoutData?.fulfillment_type
    });
  }
}