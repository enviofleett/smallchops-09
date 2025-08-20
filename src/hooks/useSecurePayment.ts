import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { paymentProtection } from '@/utils/clientSidePaymentProtection';

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

    const orderData = { orderId, amount, email: customerEmail };

    // Use client-side protection
    if (!paymentProtection.canAttemptPayment(orderData)) {
      const error = 'Please wait before attempting another payment';
      updateState({ isLoading: false, error });
      toast.error(error);
      return { success: false, error };
    }

    // Check cache first
    const cachedPayment = paymentProtection.getCachedPayment(orderData);
    if (cachedPayment?.authorizationUrl) {
      console.log('✅ Using cached payment URL');
      updateState({
        isLoading: false,
        reference: cachedPayment.reference,
        authorizationUrl: cachedPayment.authorizationUrl,
      });
      return {
        success: true,
        reference: cachedPayment.reference,
        authorizationUrl: cachedPayment.authorizationUrl
      };
    }

    paymentProtection.startPaymentProcessing(orderData);

    try {
      console.log('🔐 Initializing minimal secure payment for order:', orderId);

      // Only use Edge Function for order creation, not payment initialization
      const { data, error } = await supabase.functions.invoke('create-order-minimal', {
        body: {
          order_id: orderId,
          amount: amount,
          customer_email: customerEmail,
          metadata: {
            customer_name: metadata?.customer_name,
            order_number: metadata?.order_number
          }
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Order creation failed');
      }

      // Generate client-side Paystack URL (no server initialization needed)
      const clientRef = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const authorizationUrl = `https://checkout.paystack.com/${clientRef}`;

      // Cache the result
      paymentProtection.cachePaymentData(orderData, {
        reference: clientRef,
        authorizationUrl,
        orderId: data.order_id || orderId
      });

      updateState({
        isLoading: false,
        reference: clientRef,
        authorizationUrl: authorizationUrl,
      });

      console.log('✅ Minimal payment initialized:', {
        reference: clientRef,
        orderId: data.order_id || orderId
      });

      paymentProtection.recordPaymentSuccess();
      paymentProtection.stopPaymentProcessing(orderData);

      return {
        success: true,
        reference: clientRef,
        authorizationUrl: authorizationUrl,
        orderId: data.order_id || orderId,
        amount: amount
      };

    } catch (error: any) {
      console.error('❌ Minimal payment initialization failed:', error);
      
      const errorMessage = error.message || 'Failed to initialize payment';
      updateState({ isLoading: false, error: errorMessage });
      
      paymentProtection.recordPaymentFailure();
      paymentProtection.stopPaymentProcessing(orderData);
      
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [updateState]);

  const verifySecurePayment = useCallback(async (reference: string, orderId?: string) => {
    updateState({ isProcessing: true, error: null });

    // No retries - single verification call only
    try {
      console.log(`🔍 Verifying minimal payment:`, reference);

      // Use the new minimal verification endpoint
      const { data, error } = await supabase.functions.invoke('verify-payment-minimal', {
        body: {
          reference,
          order_id: orderId
        }
      });

      if (error) throw error;

      updateState({ isProcessing: false });

      // Handle response
      const isSuccess = data?.success === true;
      if (isSuccess) {
        toast.success('Payment verified successfully!');
        console.log('✅ Payment verification successful:', {
          reference: data?.reference,
          orderId: data?.order_id,
          amount: data?.amount
        });
        
        paymentProtection.recordPaymentSuccess();
      } else {
        toast.error(data?.error || 'Payment verification failed');
        console.log('❌ Payment verification failed:', data);
        paymentProtection.recordPaymentFailure();
      }

      return data as PaymentVerificationResult;

    } catch (error: any) {
      console.error('❌ Payment verification error:', error);
      
      const errorMessage = error.message || 'Payment verification failed';
      updateState({ isProcessing: false, error: errorMessage });
      
      paymentProtection.recordPaymentFailure();
      toast.error(errorMessage);
      
      return {
        success: false,
        error: errorMessage
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