import { supabase } from '@/integrations/supabase/client';
import { isValidPaymentReference } from './paymentReference';
import { paymentRecoveryManager } from './paymentRecovery';

export interface PaymentVerificationResult {
  success: boolean;
  data?: {
    status: string;
    amount: number;
    customer: any;
    metadata: any;
    paid_at: string;
    channel: string;
    order_id?: string;
    order_number?: string;
    order_updated?: boolean;
  };
  message?: string;
}

/**
 * Verify payment with improved error handling and format validation
 */
export const verifyPayment = async (reference: string): Promise<PaymentVerificationResult> => {
  console.log('🔍 Verifying payment:', reference);
  
  // Validate reference format (warn but don't block old formats during transition)
  if (!isValidPaymentReference(reference) && !reference.startsWith('checkout_')) {
    console.warn('⚠️ Unexpected reference format:', reference);
  }
  
  try {
    const { data, error } = await supabase.functions.invoke('paystack-secure', {
      body: {
        action: 'verify',
        reference: reference
      }
    });

    if (error) {
      console.error('❌ Payment verification failed:', error);
      
      // Try recovery if the primary verification failed
      console.log('🔄 Attempting payment recovery...');
      const recoveryResult = await paymentRecoveryManager.attemptRecovery(reference);
      
      if (recoveryResult.success) {
        console.log('✅ Payment recovered successfully');
        return recoveryResult;
      }
      
      return {
        success: false,
        message: error.message || 'Payment verification failed'
      };
    }

    // Handle different response formats from the backend
    if (data?.status === true || data?.success === true) {
      const responseData = data.data || data;
      
      return {
        success: true,
        data: {
          status: responseData.status || 'success',
          amount: typeof responseData.amount === 'number' ? responseData.amount : 0,
          customer: responseData.customer,
          metadata: responseData.metadata,
          paid_at: responseData.paid_at,
          channel: responseData.channel,
          order_id: responseData.order_id,
          order_number: responseData.order_number,
          order_updated: responseData.order_updated || false
        }
      };
    } else {
      console.error('❌ Payment verification failed - invalid response:', data);
      
      // Try recovery on failed API response
      console.log('🔄 Attempting payment recovery after failed verification...');
      const recoveryResult = await paymentRecoveryManager.attemptRecovery(reference);
      
      if (recoveryResult.success) {
        console.log('✅ Payment recovered after failed verification');
        return recoveryResult;
      }
      
      return {
        success: false,
        message: data?.error || data?.message || 'Payment verification failed'
      };
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    // Try recovery on exception
    console.log('🔄 Attempting payment recovery after exception...');
    try {
      const recoveryResult = await paymentRecoveryManager.attemptRecovery(reference);
      
      if (recoveryResult.success) {
        console.log('✅ Payment recovered after exception');
        return recoveryResult;
      }
    } catch (recoveryError) {
      console.error('❌ Recovery also failed:', recoveryError);
    }
    
    return {
      success: false,
      message: (error as Error).message || 'Payment verification failed'
    };
  }
};

/**
 * Enhanced payment callback handler for success pages
 */
export const handlePaymentCallback = async (reference: string): Promise<PaymentVerificationResult> => {
  console.log('🔄 Processing payment callback for:', reference);
  
  try {
    const verificationResult = await verifyPayment(reference);
    
    if (verificationResult.success) {
      console.log('✅ Payment callback verified successfully');
      
      // Store success details for order confirmation page
      const orderDetails = {
        reference,
        orderId: verificationResult.data?.order_id,
        orderNumber: verificationResult.data?.order_number,
        amount: verificationResult.data?.amount,
        paidAt: verificationResult.data?.paid_at,
        channel: verificationResult.data?.channel
      };
      
      try {
        sessionStorage.setItem('paymentSuccess', JSON.stringify(orderDetails));
        localStorage.setItem('lastPaymentSuccess', JSON.stringify(orderDetails));
      } catch (storageError) {
        console.warn('Failed to store payment success details:', storageError);
      }
    }
    
    return verificationResult;
    
  } catch (error) {
    console.error('❌ Callback handling error:', error);
    return {
      success: false,
      message: 'An error occurred while processing your payment'
    };
  }
};