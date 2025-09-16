import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { verifyPayment, PaymentError, checkPendingPayment } from "@/utils/paystackIntegration";

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

      console.log('🔄 Using process-checkout for consistent payment processing');

      // Use consistent payment processor that handles both new orders and existing orders
      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: {
          action: 'existing_order_payment',
          order_id: orderId,
          customer_email: customerEmail,
        }
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Payment initialization failed');
      
      // The process-checkout function handles the redirect automatically
      return { 
        success: true,
        reference: data.payment?.reference,
        authorizationUrl: data.payment?.authorization_url,
        accessCode: data.payment?.access_code,
        orderId: orderId,
        amount: amount
      };

    } catch (error: any) {
      console.error('❌ Secure payment initialization failed:', error);
      
      const errorMessage = error.message || 'Failed to initialize secure payment';
      updateState({ isLoading: false, error: errorMessage });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [updateState, validatePaymentData]);

  const verifySecurePayment = useCallback(async (reference: string, orderId?: string, options?: { suppressToasts?: boolean }) => {
    updateState({ isProcessing: true, error: null });

    try {
      console.log(`🔍 Verifying secure payment:`, reference);

      // Use enhanced verification function
      const result = await verifyPayment(reference, { maxRetries: 4, retryDelay: 1000 });

      updateState({ isProcessing: false });

      if (result.success) {
        if (!options?.suppressToasts) {
          toast.success('Payment verified successfully!');
        }
        console.log('✅ Payment verification successful:', {
          reference: result.reference,
          orderId: result.order_id,
          amount: result.amount
        });
      }

      return result as PaymentVerificationResult;

    } catch (error: any) {
      console.error('❌ Payment verification failed:', error);
      
      const errorMessage = error instanceof PaymentError ? error.message : 
                          (error.message || 'Payment verification failed');
      updateState({ isProcessing: false, error: errorMessage });
      
      if (!options?.suppressToasts) {
        toast.error(errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        reference: reference
      };
    }
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
  const checkPendingPaymentStatus = useCallback(async () => {
    try {
      // Use enhanced pending payment check
      return await checkPendingPayment();
    } catch (error) {
      console.log('❌ No pending payment found');
      return null;
    }
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    initializeSecurePayment,
    verifySecurePayment,
    openSecurePayment,
    resetState,
    checkPendingPayment: checkPendingPaymentStatus,
    
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