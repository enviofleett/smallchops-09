
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { usePaystackConfig } from '@/hooks/usePaystackConfig';
import { PaymentErrorHandler } from './PaymentErrorHandler';
import { toast } from '@/hooks/use-toast';

interface PaystackPaymentHandlerProps {
  amount: number;
  email: string;
  reference: string;
  orderNumber: string;
  paymentUrl: string;
  onSuccess: (reference: string) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

// Generate truly unique reference
const generateUniqueReference = () => {
  const timestamp = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `PAY_${timestamp}_${randomHex}`;
};

export const PaystackPaymentHandler: React.FC<PaystackPaymentHandlerProps> = ({
  amount,
  email,
  reference: initialReference,
  orderNumber,
  paymentUrl,
  onSuccess,
  onError,
  onClose
}) => {
  const { config, loading: configLoading, error: configError } = usePaystackConfig();
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [currentReference, setCurrentReference] = useState(initialReference);

  // Clear any previous payment state on mount
  useEffect(() => {
    console.log('🔄 PaystackPaymentHandler: Clearing previous payment state');
    setPaymentInProgress(false);
    setScriptError(null);
    
    // Generate new reference if the initial one might be duplicate
    const newReference = generateUniqueReference();
    console.log('🆔 Reference validation:', {
      initial: initialReference,
      new: newReference,
      timestamp: Date.now()
    });
    
    setCurrentReference(newReference);
  }, [initialReference]);

  // Load Paystack script
  useEffect(() => {
    const loadPaystackScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.PaystackPop) {
          console.log('✅ Paystack script already loaded');
          resolve();
          return;
        }

        const existingScript = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
        if (existingScript) {
          console.log('⏳ Paystack script loading...');
          existingScript.addEventListener('load', () => resolve());
          existingScript.addEventListener('error', () => reject(new Error('Script failed to load')));
          return;
        }

        console.log('📦 Loading Paystack script');
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => {
          console.log('✅ Paystack script loaded successfully');
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Paystack script'));
        document.head.appendChild(script);
      });
    };

    loadPaystackScript()
      .then(() => setPaystackReady(true))
      .catch((error) => {
        console.error('❌ Paystack script loading error:', error);
        setScriptError(error.message);
      });
  }, []);

  const initializePayment = useCallback(async () => {
    if (!config || !paystackReady) {
      console.log('⚠️ Payment not ready:', { config: !!config, paystackReady });
      return;
    }

    // Clear any previous payment state
    setPaymentInProgress(false);
    await new Promise(resolve => setTimeout(resolve, 100));

    setPaymentInProgress(true);

    try {
      // Generate fresh reference for this attempt
      const freshReference = generateUniqueReference();
      setCurrentReference(freshReference);

      console.log('🚀 Initializing Paystack payment:', {
        reference: freshReference,
        amount: amount * 100,
        email,
        orderNumber
      });

      const handler = window.PaystackPop.setup({
        key: config.publicKey,
        email,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        ref: freshReference,
        channels: ['card', 'bank', 'ussd', 'mobile_money'],
        metadata: {
          order_number: orderNumber,
          customer_email: email,
          original_reference: initialReference
        },
        callback: function(response: any) {
          console.log('✅ Paystack callback:', response);
          setPaymentInProgress(false);
          
          if (response.status === 'success') {
            console.log('🎉 Payment successful:', response.reference);
            toast({
              title: "Payment Successful!",
              description: "Your payment has been processed successfully.",
            });
            onSuccess(response.reference);
          } else {
            console.log('❌ Payment failed:', response);
            onError(response.message || "Payment was not completed successfully");
          }
        },
        onClose: function() {
          console.log('🚪 Payment popup closed');
          setPaymentInProgress(false);
          onClose?.();
        }
      });

      handler.openIframe();

    } catch (error) {
      setPaymentInProgress(false);
      console.error('💥 Payment initialization error:', error);
      
      // Check if it's a duplicate reference error
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment';
      if (errorMessage.includes('Duplicate Transaction Reference')) {
        console.log('🔄 Duplicate reference detected, retrying with new reference');
        // Automatically retry with new reference
        setTimeout(() => {
          initializePayment();
        }, 1000);
        return;
      }
      
      onError(errorMessage);
    }
  }, [config, paystackReady, amount, email, orderNumber, onSuccess, onError, onClose, initialReference]);

  const handleFallbackPayment = useCallback(() => {
    console.log('🔄 Using fallback payment method');
    toast({
      title: "Redirecting to Payment Page",
      description: "Opening secure payment page in a new window...",
    });
    
    setTimeout(() => {
      window.open(paymentUrl, '_blank');
    }, 1000);
  }, [paymentUrl]);

  const handleRetry = useCallback(() => {
    console.log('🔄 Retrying payment initialization');
    setScriptError(null);
    setPaymentInProgress(false);
    
    // Generate new reference for retry
    const newReference = generateUniqueReference();
    setCurrentReference(newReference);
    
    // Small delay before retry
    setTimeout(() => {
      initializePayment();
    }, 500);
  }, [initializePayment]);

  // Show loading state
  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span>Loading payment configuration...</span>
      </div>
    );
  }

  // Show configuration error
  if (configError) {
    return (
      <PaymentErrorHandler
        error={configError}
        onRetry={handleRetry}
        onFallback={handleFallbackPayment}
      />
    );
  }

  // Show script error
  if (scriptError) {
    return (
      <PaymentErrorHandler
        error={scriptError}
        onRetry={handleRetry}
        onFallback={handleFallbackPayment}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={initializePayment}
        disabled={paymentInProgress || !paystackReady || !config}
        className="w-full"
        size="lg"
      >
        {paymentInProgress ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ₦{amount.toLocaleString()}
          </>
        )}
      </Button>

      {!paystackReady && !scriptError && (
        <div className="text-center text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
          Loading secure payment...
        </div>
      )}

      <div className="text-center">
        <Button
          variant="link"
          size="sm"
          onClick={handleFallbackPayment}
          disabled={paymentInProgress}
        >
          Having trouble? Try alternative payment method
        </Button>
      </div>

      {/* Debug info for development */}
      <div className="text-xs text-muted-foreground text-center">
        Reference: {currentReference.slice(-8)}...
      </div>
    </div>
  );
};
