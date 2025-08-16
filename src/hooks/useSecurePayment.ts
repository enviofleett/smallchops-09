import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SecurePaymentState {
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  reference: string | null;
  authorizationUrl: string | null;
}

interface PaymentInitRequest {
  orderId: string;
  amount: number;
  customerEmail: string;
  redirectUrl?: string;
  metadata?: any;
}

interface PaymentVerificationResult {
  success: boolean;
  payment_status: string;
  reference: string;
  order_id: string;
  amount: number;
  paid_at?: string;
  channel?: string;
  customer_email: string;
}

export const useSecurePayment = () => {
  const [state, setState] = useState<SecurePaymentState>({
    isLoading: false,
    isProcessing: false,
    error: null,
    reference: null,
    authorizationUrl: null,
  });

  const updateState = useCallback((updates: Partial<SecurePaymentState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    updateState({
      isLoading: false,
      isProcessing: false,
      error: null,
      reference: null,
      authorizationUrl: null,
    });
  }, [updateState]);

  const initializeSecurePayment = useCallback(async ({
    orderId,
    amount,
    customerEmail,
    redirectUrl,
    metadata
  }: PaymentInitRequest) => {
    updateState({ isLoading: true, error: null });

    try {
      console.log('🔐 Initializing secure payment for order:', orderId);

      // Primary function call with fallback to paystack-secure
      let data, error;
      
      try {
        const result = await supabase.functions.invoke('secure-payment-processor', {
          body: {
            order_id: orderId,
            amount,
            customer_email: customerEmail,
            redirect_url: redirectUrl,
            metadata
          }
        });
        data = result.data;
        error = result.error;
      } catch (primaryError: any) {
        console.warn('Primary function failed, trying fallback:', primaryError.message);
        
        // Fallback to paystack-secure if primary fails
        const fallbackResult = await supabase.functions.invoke('paystack-secure', {
          body: {
            action: 'initialize',
            email: customerEmail,
            amount: amount * 100, // Convert to kobo for paystack-secure
            metadata: {
              order_id: orderId,
              customer_name: metadata?.customer_name,
              order_number: metadata?.order_number
            },
            callback_url: redirectUrl
          }
        });
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      updateState({
        isLoading: false,
        reference: data.reference,
        authorizationUrl: data.authorization_url,
      });

      console.log('✅ Secure payment initialized:', {
        reference: data.reference,
        orderId: data.order_id
      });

      return {
        success: true,
        reference: data.reference,
        authorizationUrl: data.authorization_url,
        accessCode: data.access_code,
        orderId: data.order_id,
        amount: data.amount
      };

    } catch (error: any) {
      console.error('❌ Secure payment initialization failed:', error);
      
      const errorMessage = error.message || 'Failed to initialize secure payment';
      updateState({ isLoading: false, error: errorMessage });
      
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [updateState]);

  const verifySecurePayment = useCallback(async (reference: string, orderId?: string) => {
    updateState({ isProcessing: true, error: null });

    // Enhanced retry logic with exponential backoff
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🔍 Verifying secure payment (attempt ${attempt + 1}):`, reference);

        // 🚨 SECURITY: Validate reference format before sending to backend
        if (reference.startsWith('pay_')) {
          throw new Error('Cannot verify frontend-generated payment references');
        }

        if (!reference.startsWith('txn_')) {
          throw new Error('Invalid payment reference format');
        }

        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: {
            reference,
            order_id: orderId
          }
        });

        if (error) {
          // Check if error is retryable
          if (error.message?.includes('503') || error.message?.includes('timeout') || error.message?.includes('unavailable')) {
            throw new Error(`RETRYABLE: ${error.message}`);
          }
          throw error;
        }

        updateState({ isProcessing: false });

        if (data.success) {
          toast.success('Payment verified successfully!');
          console.log('✅ Payment verification successful:', {
            reference: data.reference,
            orderId: data.order_id,
            amount: data.amount
          });
        } else {
          // Check if error suggests retrying
          if (data?.code === 'CONFIG_ERROR' || data?.retryable) {
            throw new Error(`RETRYABLE: ${data?.error || 'Payment verification failed'}`);
          }
          
          toast.error(data?.error || 'Payment verification failed');
          console.log('❌ Payment verification failed:', data);
        }

        return data as PaymentVerificationResult;

      } catch (error: any) {
        attempt++;
        const errorMessage = error.message || 'Payment verification failed';
        
        // Check if this is a retryable error
        const isRetryable = errorMessage.includes('RETRYABLE:') || 
                           errorMessage.includes('503') || 
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('unavailable') ||
                           errorMessage.includes('CONFIG_ERROR');

        if (isRetryable && attempt < maxRetries) {
          console.log(`🔄 Retryable error, attempt ${attempt}/${maxRetries}: ${errorMessage}`);
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Non-retryable error or max retries reached
        console.error('❌ Payment verification error after retries:', errorMessage);
        
        const finalError = errorMessage.replace('RETRYABLE: ', '');
        updateState({ isProcessing: false, error: finalError });
        
        // Show user-friendly error message
        if (finalError.includes('CONFIG_ERROR') || finalError.includes('Secret key not configured')) {
          toast.error('Payment service is temporarily unavailable. Please try again later.');
        } else if (finalError.includes('ORDER_NOT_FOUND')) {
          toast.error('Payment reference not found. Please contact support.');
        } else {
          toast.error(finalError);
        }
        
        return {
          success: false,
          error: finalError
        };
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      error: 'Payment verification failed after all retry attempts'
    };
  }, [updateState]);

  const openSecurePayment = useCallback((authorizationUrl: string) => {
    if (!authorizationUrl) {
      toast.error('No payment URL available');
      return;
    }

    console.log('🚀 Opening secure payment URL');
    
    // Clear any existing payment references from storage
    localStorage.removeItem('pending_payment_reference');
    localStorage.removeItem('paystack_reference');
    sessionStorage.removeItem('checkout_reference');
    
    // Open Paystack in new tab for better UX
    const paymentWindow = window.open(authorizationUrl, '_blank');
    
    if (!paymentWindow) {
      toast.error('Please allow popups and try again');
      return;
    }

    toast.success('Payment window opened');
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    initializeSecurePayment,
    verifySecurePayment,
    openSecurePayment,
    resetState,
    
    // Computed
    isReady: !state.isLoading && !state.isProcessing,
    hasPaymentUrl: !!state.authorizationUrl,
    hasReference: !!state.reference,
  };
};

/*
🔐 SECURE PAYMENT HOOK
- ✅ Only uses backend-generated payment references
- ✅ Validates reference format before processing
- ✅ Integrates with secure edge functions
- ✅ Handles all payment states and errors
- ✅ Clears cached frontend references
- ✅ Provides comprehensive logging

🔧 USAGE:
const { 
  initializeSecurePayment, 
  verifySecurePayment, 
  openSecurePayment,
  isLoading,
  reference,
  authorizationUrl 
} = useSecurePayment();

// Initialize payment
const result = await initializeSecurePayment({
  orderId: 'uuid',
  amount: 649.90,
  customerEmail: 'user@example.com'
});

// Open payment in new tab
if (result.success) {
  openSecurePayment(result.authorizationUrl);
}

// Verify payment (on callback page)
const verification = await verifySecurePayment('txn_...');
*/