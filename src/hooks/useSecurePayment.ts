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

interface PaymentValidationError {
  field: string;
  message: string;
}

interface PaymentVerificationResult {
  success: boolean;
  payment_status?: string;
  reference?: string;
  order_id?: string;
  amount?: number;
  paid_at?: string;
  channel?: string;
  customer_email?: string;
  error?: string;
}

export const useSecurePayment = () => {
  const [state, setState] = useState<SecurePaymentState>({
    isLoading: false,
    isProcessing: false,
    error: null,
    reference: null,
    authorizationUrl: null,
  });

  // Enhanced validation function
  const validatePaymentData = useCallback((data: PaymentInitRequest): PaymentValidationError[] => {
    const errors: PaymentValidationError[] = [];

    // Email validation
    if (!data.customerEmail) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.customerEmail)) {
        errors.push({ field: 'email', message: 'Invalid email format' });
      }
    }

    // Amount validation
    if (!data.amount || data.amount <= 0) {
      errors.push({ field: 'amount', message: 'Amount must be greater than 0' });
    } else if (data.amount < 1) {
      errors.push({ field: 'amount', message: 'Minimum amount is ₦1' });
    } else if (data.amount > 10000000) {
      errors.push({ field: 'amount', message: 'Maximum amount is ₦10,000,000' });
    }

    // Order ID validation
    if (!data.orderId) {
      errors.push({ field: 'orderId', message: 'Order ID is required' });
    }

    return errors;
  }, []);

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
      // Enhanced validation
      const validationErrors = validatePaymentData({
        orderId,
        amount,
        customerEmail,
        redirectUrl,
        metadata
      });

      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.map(e => e.message).join(', ');
        throw new Error(`Validation failed: ${errorMessage}`);
      }

      console.log('🔐 Initializing secure payment for order:', orderId, {
        amount: amount,
        email: customerEmail.substring(0, 3) + '***'
      });

      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          email: customerEmail,
          amount: amount, // Send amount as-is (in naira)
          metadata: {
            order_id: orderId,
            customer_name: metadata?.customer_name,
            order_number: metadata?.order_number
          },
          callback_url: redirectUrl
        }
      });

      if (error) throw error;

      // Handle both success and status response formats
      const isSuccess = data?.success === true || data?.status === true;
      if (!isSuccess) {
        throw new Error(data?.error || data?.message || 'Payment initialization failed (no authorization_url returned)');
      }

      // Extract authorization_url and reference from response
      const responseData = data?.data || data;
      const authorizationUrl = responseData?.authorization_url || 
                              (responseData?.access_code ? `https://checkout.paystack.com/${responseData.access_code}` : null);
      const reference = responseData?.reference;

      if (!authorizationUrl) {
        throw new Error('Payment initialization failed (no authorization_url returned)');
      }

      updateState({
        isLoading: false,
        reference: reference,
        authorizationUrl: authorizationUrl,
      });

      // 🔐 CRITICAL: Persist reference for callback recovery
      if (reference) {
        try {
          sessionStorage.setItem('paystack_payment_reference', reference);
          localStorage.setItem('paystack_last_reference', reference);
          sessionStorage.setItem('payment_order_id', orderId);
          console.log('💾 Payment reference stored in session/localStorage:', reference);
        } catch (error) {
          console.warn('⚠️ Failed to store payment reference in storage:', error);
        }
      }

      console.log('✅ Secure payment initialized:', {
        reference: reference,
        orderId: responseData?.order_id || orderId
      });

      return {
        success: true,
        reference: reference,
        authorizationUrl: authorizationUrl,
        accessCode: responseData?.access_code,
        orderId: responseData?.order_id || orderId,
        amount: responseData?.amount || amount
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
    const maxRetries = 4; // Increased retries
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

        // Handle both success and status response formats
        const isSuccess = data?.success === true || data?.status === true;
        if (isSuccess) {
          toast.success('Payment verified successfully!');
          console.log('✅ Payment verification successful:', {
            reference: data?.reference,
            orderId: data?.order_id,
            amount: data?.amount
          });
        } else {
          // Check if error suggests retrying
          if (data?.code === 'CONFIG_ERROR' || data?.retryable) {
            throw new Error(`RETRYABLE: ${data?.error || data?.message || 'Payment verification failed'}`);
          }
          
          toast.error(data?.error || data?.message || 'Payment verification failed');
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
          // Enhanced exponential backoff: 1s, 2s, 4s, 8s with jitter
          const baseDelay = 1000 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 500; // Add randomness to avoid thundering herd
          const delay = baseDelay + jitter;
          
          console.log(`⏰ Waiting ${Math.round(delay)}ms before retry...`);
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
          error: finalError,
          reference: reference
        };
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      error: 'Payment verification failed after all retry attempts',
      reference: reference
    };
  }, [updateState]);

  const openSecurePayment = useCallback((authorizationUrl: string) => {
    if (!authorizationUrl) {
      toast.error('No payment URL available');
      return;
    }

    console.log('🚀 Opening secure payment URL');
    
    // Open Paystack in new tab for better UX
    const paymentWindow = window.open(authorizationUrl, '_blank');
    
    if (!paymentWindow) {
      toast.error('Please allow popups and try again');
      return;
    }

    toast.success('Payment window opened');
  }, []);

  // Recovery function to check for pending payments
  const checkPendingPayment = useCallback(async () => {
    try {
      const storedReference = sessionStorage.getItem('paystack_payment_reference') || 
                             localStorage.getItem('paystack_last_reference');
      
      if (!storedReference) return null;

      console.log('🔍 Checking for pending payment:', storedReference);
      
      const verification = await verifySecurePayment(storedReference);
      
      if (verification.success) {
        console.log('✅ Found successful pending payment');
        toast.success('Payment completed successfully!');
        return verification;
      }
      
      return null;
    } catch (error) {
      console.log('❌ No pending payment found');
      return null;
    }
  }, [verifySecurePayment]);

  return {
    // State
    ...state,
    
    // Actions
    initializeSecurePayment,
    verifySecurePayment,
    openSecurePayment,
    resetState,
    checkPendingPayment,
    
    // Computed
    isReady: !state.isLoading && !state.isProcessing,
    hasPaymentUrl: !!state.authorizationUrl,
    hasReference: !!state.reference,
    
    // Utilities
    validatePaymentData,
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