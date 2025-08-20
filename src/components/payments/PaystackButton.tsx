import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { paymentProtection, initializePaystackScript, handlePaymentError } from '@/utils/clientSidePaymentProtection';

// Extend window object for Paystack
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: any) => {
        openIframe: () => void;
      };
    };
  }
}

interface PaystackButtonProps {
  email: string;
  amount: number;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
  onSuccess: (reference: string, transaction: any) => void;
  onError: (error: string) => void;
  onClose?: () => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  channels?: string[];
}

export const PaystackButton: React.FC<PaystackButtonProps> = ({
  email,
  amount,
  orderId,
  customerName,
  customerPhone,
  metadata = {},
  onSuccess,
  onError,
  onClose,
  className,
  disabled,
  children,
  channels = ['card', 'bank', 'ussd', 'mobile_money']
}) => {
  const [loading, setLoading] = useState(false);

  const initializePayment = useCallback(async () => {
    if (!email || !amount || amount <= 0) {
      toast.error('Invalid payment details');
      return;
    }

    const orderData = { orderId, amount, email };

    // Check protection mechanisms
    if (!paymentProtection.canAttemptPayment(orderData)) {
      toast.error('Please wait before attempting another payment');
      return;
    }

    // Check cache first (prevents duplicate Edge Function calls)
    const cachedPayment = paymentProtection.getCachedPayment(orderData);
    if (cachedPayment) {
      console.log('✅ Using cached payment data');
      openPaystackPopup(cachedPayment.public_key, cachedPayment.reference);
      return;
    }

    paymentProtection.startPaymentProcessing(orderData);
    setLoading(true);
    
    try {
      // Load Paystack script
      await initializePaystackScript();

      // Generate client-side reference (for immediate popup, verified server-side later)
      const clientRef = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get Paystack public key (cached or from server)
      let publicKey = localStorage.getItem('paystack_public_key');
      if (!publicKey) {
        // Only make server call if absolutely necessary
        const response = await fetch('/api/paystack-config', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const config = await response.json();
          publicKey = config.public_key;
          // Cache for 1 hour
          localStorage.setItem('paystack_public_key', publicKey);
          setTimeout(() => localStorage.removeItem('paystack_public_key'), 60 * 60 * 1000);
        } else {
          throw new Error('Unable to load payment configuration');
        }
      }

      if (!publicKey) {
        throw new Error('Payment configuration not available');
      }

      // Cache the payment data
      paymentProtection.cachePaymentData(orderData, { public_key: publicKey, reference: clientRef });

      // Open Paystack popup immediately (no server delay)
      openPaystackPopup(publicKey, clientRef);

    } catch (error) {
      paymentProtection.stopPaymentProcessing(orderData);
      setLoading(false);
      console.error('Payment initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      handlePaymentError(new Error(errorMessage), orderData);
      onError(errorMessage);
      toast.error(errorMessage);
    }
  }, [email, amount, orderId, customerName, customerPhone, metadata, channels, onSuccess, onError, onClose]);

  const openPaystackPopup = (publicKey: string, reference: string) => {
    try {
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email,
        amount: amount * 100, // Convert to kobo
        ref: reference,
        channels,
        currency: 'NGN',
        metadata: {
          order_id: orderId,
          customer_name: customerName,
          customer_phone: customerPhone,
          order_number: metadata.order_number || `ORDER-${Date.now()}`,
          ...metadata
        },
        onClose: () => {
          const orderData = { orderId, amount, email };
          paymentProtection.stopPaymentProcessing(orderData);
          setLoading(false);
          onClose?.();
        },
        callback: (response: any) => {
          const orderData = { orderId, amount, email };
          paymentProtection.stopPaymentProcessing(orderData);
          setLoading(false);
          
          if (response.status === 'success') {
            const ref = response.reference;
            paymentProtection.recordPaymentSuccess();
            
            // Store reference for verification
            try { 
              sessionStorage.setItem('paystack_last_reference', ref);
              localStorage.setItem('paystack_last_reference', ref);
              const details = JSON.stringify({ orderId, reference: ref });
              sessionStorage.setItem('orderDetails', details);
              localStorage.setItem('orderDetails', details);
            } catch {}
            
            // Navigate to callback page for server-side verification only
            window.location.href = `/payment/callback?reference=${encodeURIComponent(ref)}&status=success&order_id=${encodeURIComponent(orderId)}`;
          } else {
            paymentProtection.recordPaymentFailure();
            onError('Payment was not completed');
          }
        }
      });
      
      handler.openIframe();
    } catch (error) {
      const orderData = { orderId, amount, email };
      paymentProtection.stopPaymentProcessing(orderData);
      setLoading(false);
      handlePaymentError(error as Error, orderData);
      onError('Failed to open payment window');
    }
  };

  // Create debounced payment function
  const debouncedPayment = paymentProtection.createDebouncedPayment(initializePayment, 2000);

  return (
    <Button
      onClick={debouncedPayment}
      disabled={disabled || loading}
      className={className}
      data-payment-button="true"
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children || `Pay ₦${amount.toLocaleString()}`}
    </Button>
  );
};