import { useState } from 'react';
import { paystackService, assertServerReference, validateReferenceForVerification } from '@/lib/paystack';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaymentErrorHandler } from '@/lib/payment-error-handler';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { safeErrorMessage, handlePaymentError } from '@/utils/errorHandling';

export interface PaymentResult {
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
}

export interface PaymentVerification {
  success: boolean;
  paymentStatus?: string;
  orderStatus?: string;
  orderNumber?: string;
  orderId?: string;
  amount?: number;
  amountNaira?: number;
  paidAt?: string;
  channel?: string;
  reference?: string;
  message?: string;
}

export type PaymentProvider = 'paystack';

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { handleError } = useErrorHandler();

  const initiatePayment = async (
    orderId: string,
    amount: number,
    customerEmail?: string,
    provider: PaymentProvider = 'paystack'
  ): Promise<PaymentResult> => {
    setLoading(true);
    try {
      // 4. FRONTEND HARDENING: Use supabase.functions.invoke consistently
      console.log('🚀 [FRONTEND] Initiating payment via secure-payment-processor:', {
        orderId,
        customerEmail,
        amount // Note: This amount will be ignored by backend - DB is source of truth
      });

      const { data: response, error } = await supabase.functions.invoke('secure-payment-processor', {
        body: {
          action: 'initialize',
          order_id: orderId,
          customer_email: customerEmail || '',
          // Amount intentionally not passed - backend derives from DB
          callback_url: `${window.location.origin}/payment/callback?order_id=${encodeURIComponent(orderId)}`
        }
      });

      if (error) {
        throw new Error(error.message || 'Payment initialization failed');
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Payment initialization failed');
      }

      // Validate server reference format (should be txn_)
      let validServerRef = true;
      try {
        assertServerReference(response.reference);
        console.log('✅ [FRONTEND] Server returned valid txn_ reference:', response.reference);
      } catch (e) {
        validServerRef = false;
        console.warn('⚠️ [FRONTEND] Server returned invalid reference format:', response.reference, e);
      }

      console.log('✅ [FRONTEND] Payment initialization successful:', {
        orderId,
        reference: response.reference,
        amount: response.amount, // This is the authoritative amount from DB
        reused: response.reused || false
      });

      // Store last reference and order details for callback fallback
      try {
        if (response.reference) {
          sessionStorage.setItem('paystack_last_reference', response.reference);
          localStorage.setItem('paystack_last_reference', response.reference);
        }
        const details = JSON.stringify({ 
          orderId, 
          reference: response.reference,
          authoritativeAmount: response.amount 
        });
        sessionStorage.setItem('orderDetails', details);
        localStorage.setItem('orderDetails', details);
      } catch (e) {
        console.warn('[FRONTEND] Failed to store payment reference locally:', e);
      }

      return {
        success: true,
        url: response.authorization_url,
        sessionId: validServerRef ? response.reference : undefined
      };
    } catch (error) {
      console.error('Payment initiation error:', error);
      handleError(error, 'payment initiation');
      const errorMessage = safeErrorMessage(error);

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async (
    orderId: string,
    amount: number,
    customerEmail?: string,
    openInNewTab = true,
    provider: PaymentProvider = 'paystack'
  ): Promise<boolean> => {
    setProcessing(true);
    try {
      const result = await initiatePayment(orderId, amount, customerEmail, provider);

      if (result.success && result.url) {
        if (openInNewTab) {
          // Open checkout in a new tab
          window.open(result.url, '_blank');
        } else {
          // Redirect in the same window
          window.location.href = result.url;
        }
        return true;
      } else {
        const errorMessage = safeErrorMessage(result.error || 'Failed to process payment');
        toast.error('Payment Failed', {
          description: errorMessage,
          duration: 5000,
        });
        return false;
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      const errorMessage = safeErrorMessage(error);

      toast.error('Payment Error', {
        description: errorMessage,
        duration: 5000,
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const verifyPayment = async (
    reference: string,
    provider: PaymentProvider = 'paystack'
  ): Promise<PaymentVerification> => {
    // Validate reference format (warn but support both txn_ and legacy formats during transition)
    if (!validateReferenceForVerification(reference)) {
      console.warn('⚠️ Unexpected reference format for verification:', reference);
    }
    
    try {
      console.log('🔍 Verifying payment with secure verify-payment RPC:', reference);
      
      // Use secure-payment-processor for verification
      const { data, error } = await supabase.functions.invoke('secure-payment-processor', {
        body: { 
          action: 'verify',
          reference 
        }
      });

      if (error) throw new Error(error.message);

      const success = data?.success === true;
      if (!success) {
        console.warn('❌ Payment verification failed:', data);
        return { 
          success: false, 
          message: data?.error || 'Payment verification failed'
        };
      }

      console.log('✅ Payment verification successful:', {
        reference: data.reference,
        order_id: data.order_id,
        amount: data.amount
      });

      return {
        success: true,
        paymentStatus: data.payment_status || 'paid',
        orderStatus: data.order_status,
        orderNumber: data.order_number,
        orderId: data.order_id,
        amount: data.amount,
        amountNaira: data.amount,
        paidAt: data.paid_at,
        channel: data.channel,
        reference: data.reference,
        message: data.gateway_response || 'Payment verified successfully',
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      const errorInfo = PaymentErrorHandler.formatErrorForUser(error);

      toast.error(errorInfo.title, {
        description: errorInfo.message,
        duration: 5000,
      });
      throw error;
    }
  };

  const handlePaymentSuccess = async (sessionId: string, provider: PaymentProvider = 'paystack') => {
    try {
      const verification = await verifyPayment(sessionId, provider);

      if (verification?.success) {
        toast.success('Payment successful!');
        return verification;
      } else {
        toast.error('Payment was not completed successfully');
        return null;
      }
    } catch (error) {
      console.error('Error handling payment success:', error);
      const errorInfo = PaymentErrorHandler.formatErrorForUser(error);

      toast.error(errorInfo.title, {
        description: errorInfo.message,
        duration: 5000,
      });
      return null;
    }
  };

  const handlePaymentError = (error?: string) => {
    console.error('Payment error:', error);
    const errorInfo = PaymentErrorHandler.formatErrorForUser(new Error(error || 'Payment was cancelled or failed'));

    toast.error(errorInfo.title, {
      description: errorInfo.message,
      duration: 5000,
    });
  };

  return {
    loading,
    processing,
    initiatePayment,
    processPayment,
    verifyPayment,
    handlePaymentSuccess,
    handlePaymentError
  };
};