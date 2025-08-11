import { useState } from 'react';
import { paystackService, assertServerReference, validateReferenceForVerification } from '@/lib/paystack';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaymentErrorHandler } from '@/lib/payment-error-handler';
import { useErrorHandler } from '@/hooks/useErrorHandler';

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
  amount?: number;
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
      const response = await paystackService.initializeTransaction({
        email: customerEmail || '',
        amount: paystackService.formatAmount(amount),
        callback_url: `${window.location.origin}/payment/callback?order_id=${encodeURIComponent(orderId)}`,
        metadata: { order_id: orderId, orderId }
      });

      // Validate server reference format but don't block redirect; we'll rely on backend mapping if needed
      let validServerRef = true;
      try {
        assertServerReference(response.reference);
      } catch (e) {
        validServerRef = false;
        console.warn('Server returned invalid reference format:', response.reference, e);
      }

      // Persist the authoritative reference only if valid
      if (validServerRef) {
        try {
          await supabase
            .from('orders')
            .update({ payment_reference: response.reference, payment_method: 'paystack' })
            .eq('id', orderId);
        } catch (e) {
          console.warn('Could not persist final payment_reference (will rely on metadata):', e);
        }
      }

      return {
        success: true,
        url: response.authorization_url,
        sessionId: validServerRef ? response.reference : undefined
      };
    } catch (error) {
      console.error('Payment initiation error:', error);
      handleError(error, 'payment initiation');
      const errorInfo = PaymentErrorHandler.formatErrorForUser(error);

      return {
        success: false,
        error: errorInfo.message
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
        const errorInfo = PaymentErrorHandler.formatErrorForUser(new Error(result.error || 'Failed to process payment'));
        toast.error(errorInfo.title, {
          description: errorInfo.message,
          duration: 5000,
        });
        return false;
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      const errorInfo = PaymentErrorHandler.formatErrorForUser(error);

      toast.error(errorInfo.title, {
        description: errorInfo.message,
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
    // Validate reference format (warn but block clearly invalid ones)
    if (!validateReferenceForVerification(reference)) {
      throw new Error('Invalid reference format for verification');
    }
    try {
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference }
      });

      if (error) throw new Error(error.message);

      const success = data?.status === true || data?.success === true;
      if (!success) {
        return { success: false };
      }

      const d: any = data?.data || data;
      const order = d?.order || data?.order;

      return {
        success: true,
        paymentStatus: d?.payment_status || d?.status || (success ? 'paid' : undefined),
        orderStatus: order?.status || d?.order_status,
        orderNumber: order?.order_number || d?.order_number,
        amount: typeof d?.amount === 'number' ? d.amount : undefined,
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