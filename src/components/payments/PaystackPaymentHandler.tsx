
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

  // Load Paystack script with timeout and enhanced error handling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadPaystackScript = () => {
      return new Promise<void>((resolve, reject) => {
        // Set 10-second timeout for script loading
        timeoutId = setTimeout(() => {
          reject(new Error('Script loading timeout (10 seconds)'));
        }, 10000);

        if (window.PaystackPop) {
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        const existingScript = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
        if (existingScript) {
          const handleLoad = () => {
            clearTimeout(timeoutId);
            existingScript.removeEventListener('load', handleLoad);
            existingScript.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = () => {
            clearTimeout(timeoutId);
            existingScript.removeEventListener('load', handleLoad);
            existingScript.removeEventListener('error', handleError);
            reject(new Error('Script failed to load'));
          };
          
          existingScript.addEventListener('load', handleLoad);
          existingScript.addEventListener('error', handleError);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        
        const handleScriptLoad = () => {
          clearTimeout(timeoutId);
          script.removeEventListener('load', handleScriptLoad);
          script.removeEventListener('error', handleScriptError);
          
          // Verify PaystackPop is available
          if (window.PaystackPop) {
            resolve();
          } else {
            reject(new Error('PaystackPop not available after script load'));
          }
        };
        
        const handleScriptError = () => {
          clearTimeout(timeoutId);
          script.removeEventListener('load', handleScriptLoad);
          script.removeEventListener('error', handleScriptError);
          reject(new Error('Failed to load Paystack script'));
        };
        
        script.addEventListener('load', handleScriptLoad);
        script.addEventListener('error', handleScriptError);
        document.head.appendChild(script);
      });
    };

    setScriptError(null);
    setPaystackReady(false);
    
    loadPaystackScript()
      .then(() => {
        setPaystackReady(true);
        setScriptError(null);
      })
      .catch((error) => {
        setScriptError(error.message);
        setPaystackReady(false);
        
        // Auto-retry once after 2 seconds for timeout errors
        if (error.message.includes('timeout')) {
          setTimeout(() => {
            loadPaystackScript()
              .then(() => {
                setPaystackReady(true);
                setScriptError(null);
              })
              .catch((retryError) => {
                setScriptError(`Script loading failed: ${retryError.message}`);
              });
          }, 2000);
        }
      });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const initializePayment = useCallback(async () => {
    if (!config || !paystackReady) {
      toast({
        title: "Payment Not Ready",
        description: "Payment gateway is still loading. Please wait...",
        variant: "destructive",
      });
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

      console.log('🚀 Starting Paystack payment initialization...', {
        reference: freshReference,
        amount: amount * 100,
        email,
        orderNumber,
        paystackLoaded: !!window.PaystackPop
      });

      // Wait for Paystack to be available with timeout
      let attempts = 0;
      while (!window.PaystackPop && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.PaystackPop) {
        throw new Error('Paystack failed to load after 3 seconds');
      }

      console.log('✅ Paystack available, initializing payment popup...');

      // Improved callback URL with reference parameter
      const callbackUrl = `${window.location.origin}/payment/callback?reference=${freshReference}&status=success&order_id=${orderNumber}`;
      
      console.log('🔗 Callback URL:', callbackUrl);

      const handler = window.PaystackPop.setup({
        key: config.publicKey,
        email,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        ref: freshReference,
        callback_url: callbackUrl, // Explicit callback URL
        channels: ['card', 'bank', 'ussd', 'mobile_money'],
        metadata: {
          order_number: orderNumber,
          customer_email: email,
          original_reference: initialReference,
          callback_url: callbackUrl // Additional metadata
        },
        callback: function(response: any) {
          console.log('✅ Paystack payment callback received:', response);
          setPaymentInProgress(false);
          
          if (response.status === 'success') {
            console.log('🎉 Payment successful, redirecting to verification...');
            
            // Ensure reference is included in redirect
            const verificationUrl = `/payment/callback?reference=${response.reference || freshReference}&status=success&order_id=${orderNumber}`;
            
            console.log('🔗 Redirecting to:', verificationUrl);
            
            toast({
              title: "Payment Successful!",
              description: "Your payment has been processed. Redirecting...",
            });
            
            // Add small delay to ensure toast shows
            setTimeout(() => {
              window.location.href = verificationUrl;
            }, 1500);
            
          } else {
            console.error('❌ Payment was not successful:', response);
            toast({
              title: "Payment Failed",
              description: response.message || "Your payment was not successful. Please try again.",
              variant: "destructive",
            });
          }
        },
        onClose: function() {
          console.log('🚪 Paystack popup closed by user');
          setPaymentInProgress(false);
          // Don't show error toast for user-initiated close
        }
      });

      // Open the payment popup
      console.log('🎬 Opening Paystack payment popup...');
      handler.openIframe();

    } catch (error) {
      setPaymentInProgress(false);
      console.error('💳 Paystack initialization failed:', error);
      
      // Check if it's a duplicate reference error
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment';
      if (errorMessage.includes('Duplicate Transaction Reference')) {
        console.log('🔄 Duplicate reference detected, retrying with new reference');
        toast({
          title: "Retrying Payment",
          description: "Generating new payment reference...",
        });
        
        // Automatically retry with new reference after delay
        setTimeout(() => {
          initializePayment();
        }, 1500);
        return;
      }
      
      // Show error and fallback to redirect
      toast({
        title: "Payment Error",
        description: "Failed to open payment popup. Redirecting to secure payment page...",
        variant: "destructive",
      });
      
      setTimeout(() => {
        // Ensure callback URL is properly formatted
        const fallbackUrl = `${paymentUrl}&callback_url=${encodeURIComponent(`${window.location.origin}/payment/callback?reference=${currentReference}`)}`;
        window.location.href = fallbackUrl;
      }, 2000);
    }
  }, [config, paystackReady, amount, email, orderNumber, onSuccess, onError, onClose, initialReference, paymentInProgress, paymentUrl, currentReference]);

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
          Loading secure payment gateway...
        </div>
      )}

      {/* Progress indicator for better UX */}
      {paymentInProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-800">
              Secure payment in progress... Please do not close this window.
            </span>
          </div>
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
