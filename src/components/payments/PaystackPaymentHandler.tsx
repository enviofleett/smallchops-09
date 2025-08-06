
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

export const PaystackPaymentHandler: React.FC<PaystackPaymentHandlerProps> = ({
  amount,
  email,
  reference,
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

  // Load Paystack script
  useEffect(() => {
    const loadPaystackScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.PaystackPop) {
          resolve();
          return;
        }

        const existingScript = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve());
          existingScript.addEventListener('error', () => reject(new Error('Script failed to load')));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Paystack script'));
        document.head.appendChild(script);
      });
    };

    loadPaystackScript()
      .then(() => setPaystackReady(true))
      .catch((error) => {
        console.error('Paystack script loading error:', error);
        setScriptError(error.message);
      });
  }, []);

  const initializePayment = useCallback(async () => {
    if (!config || !paystackReady) return;

    setPaymentInProgress(true);

    try {
      const handler = window.PaystackPop.setup({
        key: config.publicKey,
        email,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        ref: reference,
        channels: ['card', 'bank', 'ussd', 'mobile_money'],
        metadata: {
          order_number: orderNumber,
          customer_email: email
        },
        callback: function(response: any) {
          setPaymentInProgress(false);
          
          if (response.status === 'success') {
            toast({
              title: "Payment Successful!",
              description: "Your payment has been processed successfully.",
            });
            onSuccess(response.reference);
          } else {
            onError(response.message || "Payment was not completed successfully");
          }
        },
        onClose: function() {
          setPaymentInProgress(false);
          onClose?.();
        }
      });

      handler.openIframe();

    } catch (error) {
      setPaymentInProgress(false);
      console.error('Payment initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment';
      onError(errorMessage);
    }
  }, [config, paystackReady, amount, email, reference, orderNumber, onSuccess, onError, onClose]);

  const handleFallbackPayment = useCallback(() => {
    // Fallback to redirect payment
    toast({
      title: "Redirecting to Payment Page",
      description: "Opening secure payment page in a new window...",
    });
    
    setTimeout(() => {
      window.open(paymentUrl, '_blank');
    }, 1000);
  }, [paymentUrl]);

  const handleRetry = useCallback(() => {
    setScriptError(null);
    window.location.reload();
  }, []);

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
    </div>
  );
};
