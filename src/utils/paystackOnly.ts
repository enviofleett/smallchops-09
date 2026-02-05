// PAYSTACK-ONLY PAYMENT UTILITIES
// ===============================
// Enforces Paystack-only payment processing with backend references

import { supabase } from '@/integrations/supabase/client';
import { PAYMENT_GATEWAY, isValidPaymentReference, isLegacyReference } from '@/components/payments/PaymentConstants';

/**
 * Initialize secure payment with backend-generated reference
 * CRITICAL: Frontend can no longer generate payment references
 */
export const initializeSecurePayment = async (
  orderId: string,
  amount: number,
  customerEmail: string,
  metadata?: any
) => {
  try {
    console.log('🔐 Initializing secure Paystack payment:', { orderId, amount });
    
    // Call secure backend function for reference generation
    const { data, error } = await supabase.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: customerEmail,
        amount,
        metadata: {
          ...metadata,
          gateway: PAYMENT_GATEWAY,
          backend_generated: true,
          source: 'frontend_secure_init',
          order_id: orderId
        },
        order_id: orderId
      }
    });

    if (error) {
      console.error('❌ Payment initialization failed:', error);
      throw new Error(error.message || 'Failed to initialize payment');
    }

    const { reference, authorization_url, access_code } = data;
    
    // Validate that backend returned a secure reference
    if (!isValidPaymentReference(reference)) {
      console.error('❌ Backend returned invalid reference format:', reference);
      throw new Error('Invalid payment reference format received from backend');
    }

    console.log('✅ Secure payment initialized:', reference);
    
    return {
      success: true,
      reference,
      authorization_url,
      access_code,
      gateway: PAYMENT_GATEWAY
    };

  } catch (error) {
    console.error('❌ Secure payment initialization error:', error);
    throw error;
  }
};

/**
 * Verify payment using backend-only verification
 */
export const verifySecurePayment = async (reference: string) => {
  try {
    // Warn about legacy references but still attempt verification
    if (isLegacyReference(reference)) {
      console.warn('⚠️ Legacy reference detected during verification:', reference);
    }

    console.log('🔍 Verifying payment with backend:', reference);
    
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { reference }
    });

    if (error) {
      console.error('❌ Payment verification failed:', error);
      throw new Error(error.message || 'Payment verification failed');
    }

    console.log('✅ Payment verification completed:', data);
    
    return {
      success: data.success,
      status: data.payment_status,
      reference: data.reference,
      amount: data.amount,
      order_id: data.order_id,
      gateway: PAYMENT_GATEWAY
    };

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    throw error;
  }
};

/**
 * Get payment status for order
 */
export const getPaymentStatus = async (orderId: string) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, payment_status, paystack_reference, total_amount, status')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('❌ Failed to get payment status:', error);
      throw new Error('Failed to get payment status');
    }

    return {
      order_id: order.id,
      payment_status: order.payment_status,
      reference: order.paystack_reference,
      amount: order.total_amount,
      order_status: order.status,
      gateway: PAYMENT_GATEWAY
    };

  } catch (error) {
    console.error('❌ Get payment status error:', error);
    throw error;
  }
};

/**
 * Report legacy reference usage for security monitoring
 */
export const reportLegacyReferenceUsage = async (
  reference: string, 
  context: string
) => {
  try {
    if (!isLegacyReference(reference)) {
      return; // Not a legacy reference, no need to report
    }

    console.warn('📊 Reporting legacy reference usage:', { reference, context });
    
    await supabase.from('security_incidents').insert({
      type: 'LEGACY_REFERENCE_USAGE',
      description: `Legacy payment reference used in ${context}`,
      reference,
      severity: 'low',
      metadata: {
        context,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
      }
    });

  } catch (error) {
    console.error('❌ Failed to report legacy reference usage:', error);
    // Don't throw - this is just monitoring
  }
};

/**
 * Validate payment reference before processing
 */
export const validatePaymentReference = (reference: string): {
  valid: boolean;
  type: 'secure' | 'legacy' | 'invalid';
  message: string;
} => {
  if (!reference) {
    return {
      valid: false,
      type: 'invalid',
      message: 'Reference is required'
    };
  }

  if (isValidPaymentReference(reference)) {
    return {
      valid: true,
      type: 'secure',
      message: 'Valid backend-generated reference'
    };
  }

  if (isLegacyReference(reference)) {
    return {
      valid: true,
      type: 'legacy',
      message: 'Legacy frontend-generated reference (deprecated)'
    };
  }

  return {
    valid: false,
    type: 'invalid',
    message: 'Invalid reference format'
  };
};

/**
 * PAYSTACK-ONLY: Constants and utilities
 */
export const PAYSTACK_ONLY = {
  GATEWAY: PAYMENT_GATEWAY,
  SUPPORTED_CURRENCIES: ['NGN'],
  DEFAULT_CURRENCY: 'NGN',
  MINIMUM_AMOUNT: 100, // ₦100
  MAXIMUM_AMOUNT: 100000000, // ₦100M
  
  // Reference format validation
  SECURE_REFERENCE_PATTERN: /^txn_\d+_[a-f0-9-]{36}$/,
  LEGACY_REFERENCE_PATTERN: /^pay_\d+_[a-z0-9]+$/,
  
  // Helper functions
  formatCurrency: (amount: number) => new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount),
  
  convertToKobo: (naira: number) => Math.round(naira * 100),
  convertFromKobo: (kobo: number) => kobo / 100,
  
  validateAmount: (amount: number) => 
    amount >= PAYSTACK_ONLY.MINIMUM_AMOUNT && amount <= PAYSTACK_ONLY.MAXIMUM_AMOUNT
};
