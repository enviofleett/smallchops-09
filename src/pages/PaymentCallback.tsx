import { useEffect, useRef, useState } from "react";
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

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'error';

interface PaymentResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  amount?: number;
  message?: string;
  error?: string;
  retryable?: boolean;
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
  const maxRetries = 3;
  const retryTimer = useRef<number | null>(null);
  const [redirected, setRedirected] = useState(false);
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  // One-time hard refresh to clear any stale Service Worker/CSP state
  useEffect(() => {
    const hardRefreshSW = async () => {
      try {
        if (sessionStorage.getItem('swHardRefreshed')) return;
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          let didUnregister = false;
          for (const reg of regs) {
            if (reg.active) {
              await reg.unregister();
              didUnregister = true;
            }
          }
          if (didUnregister) {
            sessionStorage.setItem('swHardRefreshed', '1');
            window.location.reload();
          }
        }
      } catch (e) {
        // no-op
      }
    };
    hardRefreshSW();
  }, []);

  // Robust retry controller to prevent infinite loops
  const retryRef = useRef(0);
  const scheduleRetry = (paymentReference: string, delayMs?: number) => {
    if (retryRef.current >= maxRetries) {
      setStatus('failed');
      setResult({
        success: false,
        error: 'Payment verification timeout',
        message: 'Unable to verify payment status. Please contact support with your payment reference.',
        retryable: true
      });
      return;
    }
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const next = retryRef.current + 1;
    retryRef.current = next;
    setRetryCount(next);
    const delays = [2000, 3000, 5000];
    const computedDelay = delayMs ?? delays[Math.min(next - 1, delays.length - 1)];
    retryTimer.current = window.setTimeout(() => {
      verifyPayment(paymentReference);
    }, computedDelay);
  };

  // Enhanced parameter detection with fallback handling
  const getPaymentReference = () => {
    // Try multiple parameter names that Paystack might use
    const possibleRefs = [
      searchParams.get('reference'),
      searchParams.get('trxref'),
      searchParams.get('transaction_id'),
      searchParams.get('tx_ref'),
      searchParams.get('txref')
    ];
    
    return possibleRefs.find(ref => ref && ref.length > 0) || null;
  };

  const reference = getPaymentReference();
  const paymentStatus = searchParams.get('status');
  const forceUi = ((searchParams.get('force') || '').toLowerCase() === 'ui');

  // Disabled instant redirect: always verify before navigating
  useEffect(() => {
    // Intentionally left blank to enforce verification-first flow
  }, []);

  // If no reference, show error instead of redirecting
  useEffect(() => {
    if (redirected || forceUi) return;
    if (!reference) {
      console.warn('PaymentCallback - No reference; showing error UI');
      setStatus('error');
      setResult({
        success: false,
        error: 'No payment reference found',
        message: 'We could not detect your payment reference. Please check your email for order status or contact support.',
        retryable: false
      });
    }
  }, [reference, forceUi, redirected]);

  // Fallback: full verification flow (when status not explicitly success)
  useEffect(() => {
    if (redirected) return;
    // Debug: Log all URL parameters for troubleshooting
    const allParams = Object.fromEntries(searchParams.entries());
    console.log('PaymentCallback - All URL params:', allParams);
    console.log('PaymentCallback - Detected reference:', reference);
    
    // Fallback: try session storage if reference is missing (some gateways omit it)
    if (!reference) {
      const storedRef = sessionStorage.getItem('paystack_last_reference') || localStorage.getItem('paystack_last_reference');
      const storedOrder = sessionStorage.getItem('orderDetails');
      const orderId = (() => { try { return storedOrder ? JSON.parse(storedOrder)?.orderId : null; } catch { return null; } })();
      if (storedRef) {
        const params = new URLSearchParams(window.location.search);
        params.set('reference', storedRef);
        if (orderId) params.set('order_id', orderId);
        // Replace the URL so refresh keeps the reference
        navigate(`${window.location.pathname}?${params.toString()}`, { replace: true });
        return; // wait for next effect run with reference present
      }
    }
    
    if (!reference) {
      console.error('PaymentCallback - No payment reference found in URL');
      setStatus('error');
      setResult({
        success: false,
        error: 'No payment reference found',
        message: 'Invalid payment callback URL - missing reference parameter. Please check the URL or contact support.',
        retryable: false
      });
      return;
    }

    // If Paystack indicates success in URL params, verify immediately
    if (paymentStatus === 'success' || paymentStatus === 'successful') {
      console.log('PaymentCallback - Success indicated in URL, verifying...');
    }

    verifyPayment(reference);
  }, [reference, paymentStatus]);

  const verifyPayment = async (paymentReference: string) => {
    try {
      console.log(`🔍 Verifying payment (attempt ${retryCount + 1}):`, paymentReference);
      setStatus('verifying');

      // Prefer secure verification (updates orders + transactions)
      const { data: primaryData, error: primaryError } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference: paymentReference }
      });

      const normalize = (res: any) => {
        // paystack-secure: { status: true, data }
        if (res?.status === true) return { ok: true, data: res };
        // paystack-verify: { success: true, ... }
        if (res?.success === true) return { ok: true, data: res };
        return { ok: false, error: res?.error || res?.message || 'Payment verification failed' };
      };

      let normalized = !primaryError ? normalize(primaryData) : { ok: false, error: primaryError?.message };

      if (!normalized.ok) {
        const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('paystack-verify', {
          body: { reference: paymentReference }
        });
        if (fallbackError) throw new Error(fallbackError.message || 'Verification failed');
        normalized = normalize(fallbackData);
      }

      const data = normalized.data;

      // Handle success response
      if (data?.success === true || data?.status === true || data?.data?.status === 'success') {
        console.log('🎉 Payment verification successful');
        setStatus('success');
        setResult({
          success: true,
          order_id: data.order_id,
          order_number: data.order_number,
          amount: data.data?.amount || data.amount,
          message: data.message || 'Payment verified successfully! Your order has been confirmed.'
        });
        
        // Stop retries on success
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
        retryRef.current = maxRetries;
        
        // Clear cart and refresh orders
        console.log('🛒 Processing successful payment');
        await clearCartAfterPayment(data.order_number);
        clearCheckoutState();
        try { 
          sessionStorage.removeItem('paystack_last_reference'); 
          localStorage.removeItem('paystack_last_reference'); 
        } catch {}
        
        // Refresh orders
        if (refetchOrders) {
          setTimeout(async () => {
            try {
              await refetchOrders();
              console.log('🔄 Orders refreshed');
            } catch (refreshError) {
              console.warn('Failed to refresh orders:', refreshError);
            }
          }, 1500);
        }
      } else if (data?.status === 'pending' && retryCount < maxRetries) {
        // Payment still pending, retry
        console.log(`Payment pending, retrying... (${retryRef.current + 1}/${maxRetries})`);
        scheduleRetry(paymentReference);
        return;
      } else {
        // Payment failed or other error
        const errorMsg = data?.error || data?.message || 'Payment verification failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = retryCount < maxRetries && 
                         !errorMessage.includes('Access denied') && 
                         !errorMessage.includes('Invalid');

      if (isRetryable) {
        console.log(`Retrying verification... (${retryRef.current + 1}/${maxRetries})`);
        scheduleRetry(paymentReference);
        return;
      }

      // Max retries reached or non-retryable error
      setStatus('failed');
      setResult({
        success: false,
        error: errorMessage,
        message: 'Unable to verify payment. Please contact support with your payment reference.',
        retryable: false
      });
    }
  };

  const handleRetry = () => {
    if (reference) {
      setRetryCount(0);
      verifyPayment(reference);
    }
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
        return retryCount > 0 ? `Verifying Payment... (Retry ${retryCount})` : 'Verifying Payment...';
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
          ? 'Retrying payment verification...' 
          : 'Please wait while we verify your payment...';
      case 'success':
        return 'Your order has been confirmed and will be processed shortly.';
      case 'failed':
        return 'Your payment was not successful. Please try again.';
      case 'error':
        return 'There was an error verifying your payment. Please contact support.';
    }
  };

  const handleContinue = () => {
    if (status === 'success') {
      navigate('/customer-profile');
    } else {
      navigate('/cart');
    }
  };

  if (redirected) return null;

  return (
    <>
      <Helmet>
        <title>Paystack Payment Verification | Starters Small Chops</title>
        <meta name="description" content="Verify your Paystack payment and order status." />
        <link rel="canonical" href={`${window.location.origin}/payment/callback`} />
      </Helmet>
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
                  Attempt {retryCount} of {maxRetries}
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
              
              {result.amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">₦{result.amount.toLocaleString()}</span>
                </div>
              )}

              {reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono text-xs">{reference}</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 space-y-2">
            <Button
              onClick={handleContinue}
              className="w-full"
              disabled={status === 'verifying'}
              variant={status === 'success' ? 'default' : 'outline'}
            >
              {status === 'success' ? 'View Orders' : 'Back to Cart'}
            </Button>
            
            {status !== 'verifying' && status !== 'success' && result?.retryable && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="w-full"
                disabled={retryCount >= maxRetries}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {retryCount >= maxRetries ? 'Max Retries Reached' : 'Retry Verification'}
              </Button>
            )}

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

          {(status === 'failed' || status === 'error') && (
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>Need help? Contact our support team</p>
              {reference && (
                <p className="text-xs">
                  Reference your payment with ID: <code className="bg-muted px-1 rounded">{reference}</code>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
