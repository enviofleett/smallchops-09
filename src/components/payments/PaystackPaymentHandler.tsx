
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { usePaystackConfig } from '@/hooks/usePaystackConfig';
import { PaymentErrorHandler } from './PaymentErrorHandler';
import { toast } from '@/hooks/use-toast';
import { paystackService, assertServerReference } from '@/lib/paystack';

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

// Client-side reference generation removed; server reference will be used exclusively

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
    
    // Do not generate client references; will set after server init
    setCurrentReference(initialReference || '');
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
        // Initialize on server to get the authoritative reference
        const callbackUrl = `${window.location.origin}/payment/callback?order_number=${encodeURIComponent(orderNumber)}`;
        const init = await paystackService.initializeTransaction({
          email,
          amount: paystackService.formatAmount(amount),
          callback_url: callbackUrl,
          channels: ['card', 'bank', 'ussd', 'mobile_money'],
          metadata: {
            order_number: orderNumber,
            customer_email: email,
            original_reference: initialReference
          }
        });

        let serverRef = init.reference;
        setCurrentReference(serverRef);
        try {
          if (serverRef) {
            sessionStorage.setItem('paystack_last_reference', serverRef);
            localStorage.setItem('paystack_last_reference', serverRef);
          }
          const details = JSON.stringify({ orderNumber, reference: serverRef });
          sessionStorage.setItem('orderDetails', details);
          localStorage.setItem('orderDetails', details);
        } catch {}
        console.log('🎯 REFERENCE TRACKING [INIT]:', { received: serverRef, url: init.authorization_url });

        // Validate server-generated reference and reinitialize if needed
        try {
          assertServerReference(serverRef);
        } catch (e) {
          console.warn('Invalid reference detected, reinitializing payment with server:', serverRef, e);
          const newRef = await paystackService.reinitializeIfNeeded(serverRef, {
            email,
            amount: paystackService.formatAmount(amount),
            callback_url: callbackUrl,
            channels: ['card', 'bank', 'ussd', 'mobile_money'],
            metadata: {
              order_number: orderNumber,
              customer_email: email,
              original_reference: initialReference
            }
          });
          serverRef = newRef;
          setCurrentReference(newRef);
        }

        // If inline available, use serverRef; otherwise redirect
        if (window.PaystackPop && config?.publicKey) {
          const handler = window.PaystackPop.setup({
            key: config.publicKey,
            email,
            amount: paystackService.formatAmount(amount),
            currency: 'NGN',
            ref: serverRef,
            callback_url: `${callbackUrl}&reference=${serverRef}`,
            channels: ['card', 'bank', 'ussd', 'mobile_money'],
            metadata: {
              order_number: orderNumber,
              customer_email: email,
              original_reference: initialReference
            },
            callback: function(response: any) {
              setPaymentInProgress(false);
              if (response.status === 'success') {
                const ref = response.reference || serverRef;
                console.log('🎯 REFERENCE TRACKING [CALLBACK]:', { refFromPaystack: response.reference, serverRef: serverRef, match: (response.reference === serverRef) });
                window.location.href = `/payment/callback?reference=${encodeURIComponent(ref)}&status=success&order_number=${encodeURIComponent(orderNumber)}`;
              } else {
                toast({
                  title: "Payment Failed",
                  description: response.message || "Your payment was not successful. Please try again.",
                  variant: "destructive",
                });
              }
            },
            onClose: function() {
              setPaymentInProgress(false);
            }
          });
          handler.openIframe();
        } else {
          window.location.href = init.authorization_url;
        }

      } catch (error) {
        setPaymentInProgress(false);
        console.error('💳 Paystack initialization failed:', error);
        toast({
          title: "Payment Error",
          description: "Failed to start payment. Redirecting to secure page...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = paymentUrl;
        }, 1500);
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
    
    // No client reference generation; just retry server initialization
    setCurrentReference('');
    
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
        Reference: {currentReference ? currentReference.slice(-8) : '—'}...
      </div>
    </div>
  );
};
