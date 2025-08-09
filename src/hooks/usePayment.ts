import { useState } from 'react';
import { paystackService } from '@/lib/paystack';
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
      const reference = paystackService.generateReference();
      const response = await paystackService.initializeTransaction({
        email: customerEmail || '',
        amount: paystackService.formatAmount(amount),
        reference,
        callback_url: `${window.location.origin}/payment/callback`,
        metadata: { orderId }
      });

      return {
        success: true,
        url: response.authorization_url,
        sessionId: response.reference
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
  ): Promise<any> => {
    try {
      // Prefer enhanced verification function first
      const { data: primaryData, error: primaryError } = await supabase.functions.invoke('paystack-verify', {
        body: { reference }
      });

      const normalize = (res: any) => {
        // paystack-verify: { success, data, message }
        if (res?.success) {
          return { success: true, ...res, data: res.data };
        }
        // paystack-secure: { status: true, data }
        if (res?.status === true) {
          return { success: true, ...res, data: res.data };
        }
        return { success: false, error: res?.error || res?.message || 'Payment verification failed' };
      };

      if (!primaryError && primaryData) {
        const normalized = normalize(primaryData);
        if (normalized.success) return normalized;
      }

      // Fallback to legacy verification
      const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference }
      });

      if (fallbackError) throw new Error(fallbackError.message);

      return normalize(fallbackData);
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