
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentInitResponse {
  success: boolean;
  authorization_url?: string;
  access_code?: string;
  reference?: string;
  amount?: number;
  mode?: string;
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  url?: string;
  sessionId?: string;
  error?: string;
}

export interface PaymentVerification {
  success: boolean;
  amountNaira?: number;
  status?: string;
  reference?: string;
}

export type PaymentProvider = 'paystack';

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);

  // PATCH: expect success + use returned URL/reference
  const initializePayment = async ({ 
    orderId, 
    customerEmail 
  }: { 
    orderId: string; 
    customerEmail: string; 
  }) => {
    setIsLoading(true);
    
    try {
      console.log('🔄 [FRONTEND] Initializing payment:', { orderId, customerEmail });

      const { data: response, error } = await supabase.functions.invoke('secure-payment-processor', {
        body: {
          action: 'initialize',
          order_id: orderId,
          customer_email: customerEmail || '',
          // Amount explicitly NOT passed - backend calculates from order table
          callback_url: `${window.location.origin}/payment/callback?order_id=${encodeURIComponent(orderId)}`
        }
      });

      console.log('🔄 [FRONTEND] Payment processor response:', {
        success: !!response?.success,
        hasAuthUrl: !!response?.authorization_url,
        reference: response?.reference,
        amount: response?.amount,
        mode: response?.mode,
        error: error?.message
      });

      if (error) {
        console.error('❌ [FRONTEND] Payment initialization error:', error);
        throw new Error(error.message);
      }

      // PATCH: Check for success flag and required fields
      if (!response?.success || !response?.authorization_url) {
        console.error('❌ [FRONTEND] Invalid payment response:', response);
        throw new Error(response?.error || 'Payment initialization failed - missing required fields');
      }

      console.log('✅ [FRONTEND] Payment initialized successfully:', {
        reference: response.reference,
        amount: response.amount,
        mode: response.mode
      });

      return { 
        url: response.authorization_url, 
        reference: response.reference, 
        amount: response.amount,
        mode: response.mode
      };
    } catch (error) {
      console.error('❌ [FRONTEND] Payment initialization failed:', error);
      const message = error instanceof Error ? error.message : 'Payment initialization failed';
      toast.error(`Payment Error: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPayment = async (reference: string) => {
    setIsLoading(true);
    
    try {
      console.log('🔍 [FRONTEND] Verifying payment:', { reference });

      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { reference }
      });

      if (error) {
        console.error('❌ [FRONTEND] Payment verification error:', error);
        throw new Error(error.message);
      }

      console.log('✅ [FRONTEND] Payment verification response:', data);
      return data;
    } catch (error) {
      console.error('❌ [FRONTEND] Payment verification failed:', error);
      const message = error instanceof Error ? error.message : 'Payment verification failed';
      toast.error(`Verification Error: ${message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy aliases for backward compatibility
  const initiatePayment = async (orderId: string, amount: number, email?: string): Promise<PaymentResult> => {
    try {
      const result = await initializePayment({ orderId, customerEmail: email || '' });
      return {
        success: true,
        url: result.url,
        sessionId: result.reference
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  };

  const processPayment = async (orderId: string, amount: number, email: string, openInNewTab = false, provider: PaymentProvider = 'paystack') => {
    try {
      const result = await initializePayment({ orderId, customerEmail: email });
      if (openInNewTab) {
        window.open(result.url, '_blank');
      } else {
        window.location.href = result.url;
      }
      return true;
    } catch (error) {
      console.error('Process payment error:', error);
      return false;
    }
  };

  return {
    initializePayment,
    verifyPayment,
    isLoading,
    // Legacy aliases
    initiatePayment,
    processPayment,
    loading: isLoading
  };
};
