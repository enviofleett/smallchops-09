import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/useCart";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logPaymentVerification } from "@/utils/paymentMetrics";
import { isValidPaymentReference } from "@/utils/paymentReference";
import { 
  logCallbackReceived, 
  logVerificationStarted, 
  logVerificationCompleted, 
  logReferenceMissing 
} from "@/utils/paymentMonitoring";
import { paymentCompletionCoordinator } from "@/utils/paymentCompletion";
import { verifyPayment } from "@/utils/paymentVerification";

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'error';

interface PaymentResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  amount?: number;
  message?: string;
  error?: string;
  retryable?: boolean;
  canRetry?: boolean;
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { refetch: refetchOrders } = useCustomerOrders();
  const { clearCartAfterPayment, clearCheckoutState } = useOrderProcessing();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const queryClient = useQueryClient();
  
  // CRITICAL FIX: Single verification guard
  const verificationRef = useRef(false);
  const mountedRef = useRef(true);
  const navigationHandledRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      verificationRef.current = false;
    };
  }, []);

  // FIXED: Enhanced parameter detection without race conditions
  const getPaymentReference = useCallback(() => {
    // Primary: URL parameters
    const urlCandidates = [
      searchParams.get('reference'),
      searchParams.get('trxref'),
      searchParams.get('transaction_id'),
      searchParams.get('tx_ref'),
      searchParams.get('txref'),
      searchParams.get('provider_reference'),
      searchParams.get('payment_reference'),
      searchParams.get('paystack_reference')
    ];
    
    // Find valid URL reference first
    const validUrlRef = urlCandidates.find(ref => 
      ref && ref.trim().length > 8 && isValidPaymentReference(ref)
    );
    
    if (validUrlRef) {
      console.log('✅ Found valid reference in URL:', validUrlRef);
      return validUrlRef.trim();
    }
    
    // FIXED: Fallback to storage only if no URL reference
    const storageKeys = [
      'pending_payment_reference',
      'paystack_last_reference',
      'paymentReference'
    ];
    
    for (const key of storageKeys) {
      const stored = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (stored && stored.trim().length > 8) {
        console.log('🔄 Using fallback reference from storage:', { key, reference: stored });
        
        // CRITICAL: Clean up immediately to prevent reuse
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
        
        return stored.trim();
      }
    }
    
    return null;
  }, [searchParams]);

  // FIXED: Single verification effect - NO MORE RACE CONDITIONS
  useEffect(() => {
    // Prevent double execution
    if (verificationRef.current || !mountedRef.current) {
      return;
    }
    
    const reference = getPaymentReference();
    const orderIdParam = searchParams.get('order_id');
    const allParams = Object.fromEntries(searchParams.entries());
    
    console.log('🔍 PaymentCallback starting verification:', {
      reference,
      orderIdParam,
      hasParams: Object.keys(allParams).length > 0
    });
    
    // Log callback received
    logCallbackReceived(reference || undefined, allParams);
    
    if (!reference) {
      console.error('❌ No payment reference found');
      logReferenceMissing('payment_callback', Object.keys(allParams));
      
      if (mountedRef.current) {
        setStatus('error');
        setResult({
          success: false,
          error: 'Missing payment reference',
          message: 'Invalid payment callback - no reference found. Please contact support.',
          retryable: false,
          canRetry: false
        });
      }
      return;
    }
    
    // Start verification - this prevents the race condition
    verificationRef.current = true;
    verifyPaymentWithRetry(reference, orderIdParam);
    
  }, [searchParams, getPaymentReference]); // Dependencies properly managed

  // FIXED: Improved verification with better error handling
  const verifyPaymentWithRetry = async (
    paymentReference: string, 
    orderIdParam: string | null,
    maxRetries: number = 3
  ) => {
    let currentRetry = 0;
    
    while (currentRetry < maxRetries && mountedRef.current) {
      try {
        if (mountedRef.current) {
          setStatus('verifying');
          setRetryCount(currentRetry);
        }
        
        console.log(`🔄 Payment verification attempt ${currentRetry + 1}/${maxRetries}`);
        logVerificationStarted(paymentReference);

        // ENHANCED: Use improved verification with recovery
        const verificationResult = await verifyPayment(paymentReference);

        if (verificationResult.success) {
          await handleVerificationSuccess(verificationResult, paymentReference);
          return; // Success - exit retry loop
        }

        // Handle verification failure
        const errorData = {
          error: verificationResult.message,
          code: 'VERIFICATION_FAILED'
        };

        // Check if error is retryable
        const isRetryableError = verificationResult.message?.toLowerCase().includes('temporarily unavailable') ||
                               verificationResult.message?.toLowerCase().includes('timeout') ||
                               verificationResult.message?.toLowerCase().includes('network');

        if (isRetryableError) {
          throw new Error(`Service temporarily unavailable: ${verificationResult.message}`);
        }

        // Payment failed (shouldn't retry)
        await handleVerificationFailure(errorData, paymentReference, false);
        return;

        // No data and no error - unexpected
        throw new Error('Empty response from verification service');

      } catch (err: any) {
        currentRetry++;
        console.error(`❌ Verification attempt ${currentRetry} failed:`, err);
        
        const isRetryableError = err.message?.includes('Network error') ||
                               err.message?.includes('Service temporarily unavailable') ||
                               err.message?.includes('timeout');
        
        if (currentRetry >= maxRetries || !isRetryableError) {
          console.error('❌ Verification failed after all attempts');
          await handleVerificationFailure(
            { error: err.message, code: 'MAX_RETRIES_EXCEEDED' },
            paymentReference,
            isRetryableError
          );
          return;
        }
        
        // Exponential backoff with cap
        const delay = Math.min(2000 * Math.pow(2, currentRetry - 1), 10000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const handleVerificationSuccess = async (verificationResult: any, reference: string) => {
    if (!mountedRef.current || navigationHandledRef.current) return;
    
    const payload = verificationResult.data || verificationResult;
    
    console.log('✅ Payment verification successful!', payload);
    console.log('💰 Amount received from verification:', payload?.amount);
    
    setStatus('success');
    setResult({
      success: true,
      order_id: payload?.order_id,
      order_number: payload?.order_number,
      amount: payload?.amount || payload?.total_amount,
      message: 'Payment verified successfully! Your order has been confirmed.'
    });

    // Log success
    logPaymentVerification(reference, true);
    logVerificationCompleted(reference, true, { orderId: payload?.order_id });

    try {
      // Coordinate completion flow
      paymentCompletionCoordinator.coordinatePaymentCompletion(
        {
          reference,
          orderNumber: payload?.order_number,
          orderId: payload?.order_id,
          amount: payload?.amount
        },
        {
          onClearCart: () => {
            clearCart();
            clearCheckoutState();
          },
          onStopMonitoring: () => {
            // Stop monitoring
          },
          onNavigate: () => {
            // Will be handled separately
          }
        }
      );

      // Emit success event
      window.dispatchEvent(new CustomEvent('payment-confirmed', {
        detail: { orderId: payload?.order_id, orderReference: reference }
      }));

      // Notify parent window (if opened from checkout dialog)
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ 
          type: 'PAYMENT_SUCCESS', 
          orderId: payload?.order_id,
          reference: reference
        }, window.location.origin);
      }

      // Invalidate caches
      await invalidateOrdersCaches();
      if (refetchOrders) {
        setTimeout(() => refetchOrders().catch(() => {}), 500);
      }

    } catch (coordinationError) {
      console.error('Coordination error (non-blocking):', coordinationError);
    }

    // FIXED: Clean URL without causing loops
    navigationHandledRef.current = true;
    setTimeout(() => {
      if (mountedRef.current && !navigationHandledRef.current) {
        navigate('/payment/callback', { replace: true });
      }
    }, 1000);
  };

  const handleVerificationFailure = async (
    errorData: any, 
    reference: string, 
    isRetryable: boolean
  ) => {
    if (!mountedRef.current || navigationHandledRef.current) return;
    
    console.error('❌ Payment verification failed:', errorData);
    
    // Notify parent window of failure (if opened from checkout dialog)
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ 
        type: 'PAYMENT_FAILED', 
        error: errorData.error || 'Verification failed'
      }, window.location.origin);
    }
    
    setStatus('failed');
    setResult({
      success: false,
      error: errorData.error || 'Verification failed',
      message: isRetryable 
        ? 'Unable to verify payment due to temporary service issues. You can retry or contact support.'
        : 'Payment verification failed. Please contact support with your payment reference.',
      retryable: isRetryable,
      canRetry: isRetryable
    });

    // Log failure
    logPaymentVerification(reference, false, retryCount + 1, errorData.error);
    logVerificationCompleted(reference, false, { 
      error: errorData.error, 
      attempts: retryCount + 1 
    });

    // FIXED: Clean URL without causing loops
    navigationHandledRef.current = true;
    setTimeout(() => {
      if (mountedRef.current) {
        navigate('/payment/callback', { replace: true });
      }
    }, 1000);
  };

  // Cache invalidation helper
  const invalidateOrdersCaches = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      const orderIdParam = searchParams.get('order_id');
      if (orderIdParam) {
        await queryClient.invalidateQueries({ queryKey: ['order', orderIdParam] });
      }
      await queryClient.invalidateQueries({ queryKey: ['payment-verification'] });
    } catch (e) {
      console.warn('Cache invalidation warning:', e);
    }
  };

  // FIXED: Manual retry function
  const handleRetry = () => {
    if (verificationRef.current) return;
    
    const reference = getPaymentReference();
    if (reference && mountedRef.current) {
      verificationRef.current = false;
      navigationHandledRef.current = false;
      setRetryCount(0);
      setStatus('verifying');
      verifyPaymentWithRetry(reference, searchParams.get('order_id'));
    }
  };

  // UI helpers - Fixed currency formatting
  const formatCurrency = (amount?: number | null) => {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return null;
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <Clock className="h-16 w-16 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'failed':
        return <XCircle className="h-16 w-16 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-16 w-16 text-orange-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'verifying':
        return `Verifying Payment... ${retryCount > 0 ? `(Attempt ${retryCount + 1})` : ''}`;
      case 'success':
        return 'Payment Successful!';
      case 'failed':
        return 'Payment Failed';
      case 'error':
        return 'Verification Error';
    }
  };

  const getStatusMessage = () => {
    if (result?.message) return result.message;
    switch (status) {
      case 'verifying':
        return retryCount > 0 
          ? 'Retrying verification due to service issues...'
          : 'Please wait while we verify your payment...';
      case 'success':
        return 'Your order has been confirmed and will be processed shortly.';
      case 'failed':
        return 'Your payment verification encountered an issue.';
      case 'error':
        return 'There was an error processing your payment verification.';
    }
  };

  const handleContinue = () => {
    if (status === 'success') {
      navigate('/customer-profile');
    } else {
      navigate('/cart');
    }
  };

  const reference = getPaymentReference();

  return (
    <>
      <Helmet>
        <title>Payment Verification | Starters Small Chops</title>
        <meta name="description" content="Verify your payment and order status." />
        <link rel="canonical" href={`${window.location.origin}/payment/callback`} />
      </Helmet>
      
      <h1 className="sr-only">Payment Verification</h1>
      
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl">{getStatusTitle()}</CardTitle>
            <CardDescription className="text-center">
              {getStatusMessage()}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {status === 'verifying' && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                {retryCount > 0 && (
                  <div className="text-center text-sm text-muted-foreground">
                    Retry {retryCount}/3 - Please wait...
                  </div>
                )}
              </div>
            )}

            {result && status !== 'verifying' && (
              <div className="space-y-3 text-sm">
                {result.order_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Number:</span>
                    <span className="font-medium">{result.order_number}</span>
                  </div>
                )}
                
                {(typeof result.amount === 'number' && result.amount > 0) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium text-lg text-green-600">{formatCurrency(result.amount)}</span>
                  </div>
                )}

                {reference && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {reference.length > 20 ? `${reference.substring(0, 20)}...` : reference}
                    </span>
                  </div>
                )}

                {result.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{result.error}</p>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 space-y-2">
              {result?.canRetry && status !== 'verifying' && (
                <Button
                  onClick={handleRetry}
                  className="w-full"
                  variant="outline"
                  disabled={verificationRef.current}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Verification
                </Button>
              )}
              
              <Button
                onClick={handleContinue}
                className="w-full"
                disabled={status === 'verifying'}
                variant={status === 'success' ? 'default' : 'outline'}
              >
                {status === 'success' ? 'View Orders' : 'Back to Cart'}
              </Button>
              
              {status !== 'verifying' && status !== 'success' && (
                <Button
                  onClick={() => navigate('/')}
                  variant="ghost"
                  className="w-full"
                >
                  Return to Home
                </Button>
              )}
            </div>

            {(status === 'failed' || status === 'error') && reference && (
              <div className="text-center text-sm text-muted-foreground space-y-2 pt-4 border-t">
                <p>Need help? Contact support with this reference:</p>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {reference}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}