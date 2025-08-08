import { useState } from 'react';
import { publicAPI } from '@/api/public';
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
  paymentStatus: string;
  orderStatus: string;
  orderNumber: string;
  amount: number;
}

export type PaymentProvider = 'stripe' | 'paystack';

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { handleError } = useErrorHandler();

  const initiatePayment = async (
    orderId: string,
    amount: number,
    customerEmail?: string,
    provider: PaymentProvider = 'stripe'
  ): Promise<PaymentResult> => {
    setLoading(true);
    try {
      if (provider === 'paystack') {
        const reference = paystackService.generateReference();
        const response = await paystackService.initializeTransaction({
          email: customerEmail || '',
          amount,
          reference,
          callback_url: `${window.location.origin}/payment/callback`,
          metadata: { orderId }
        });
        
        return {
          success: true,
          url: response.authorization_url,
          sessionId: response.reference
        };
      } else {
        const response = await publicAPI.createPayment(orderId, amount, customerEmail);
        
        if (response.success && response.url) {
          return {
            success: true,
            sessionId: response.sessionId,
            url: response.url
          };
        } else {
          throw new Error(response.error || 'Failed to create payment session');
        }
      }
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
    provider: PaymentProvider = 'stripe'
  ): Promise<boolean> => {
    setProcessing(true);
    try {
      const result = await initiatePayment(orderId, amount, customerEmail, provider);
      
      if (result.success && result.url) {
        if (openInNewTab) {
          // Open Stripe checkout in a new tab
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
      if (provider === 'paystack') {
        // Call the enhanced paystack verify function
        const { data, error } = await supabase.functions.invoke('paystack-verify', {
          body: { reference }
        });

        if (error) throw new Error(error.message);
        
        return data.data;
      } else {
        const response = await publicAPI.verifyPayment(reference);
        
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.error || 'Payment verification failed');
        }
      }
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

  const handlePaymentSuccess = async (sessionId: string, provider: PaymentProvider = 'stripe') => {
    try {
      const verification = await verifyPayment(sessionId, provider);
      
      if (verification && verification.success) {
        if (verification.paymentStatus === 'paid') {
          toast.success(`Payment successful! Order #${verification.orderNumber} confirmed.`);
          return verification;
        } else {
          toast.error('Payment was not completed successfully');
          return null;
        }
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