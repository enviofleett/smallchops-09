import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/useCart";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logPaymentVerification } from "@/utils/paymentMetrics";
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
  const [redirected, setRedirected] = useState(false);
  const queryClient = useQueryClient();
  const verifyingRef = useRef(false);
  // Cleanup effect (no timers needed with single-call verify)
  useEffect(() => { return () => {}; }, []);
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

  // Single-call verification; no client-side retries to avoid race conditions

  // Enhanced parameter detection with fallback handling
  const getPaymentReference = () => {
    // Try multiple parameter names that Paystack might use
    const possibleRefs = [
      searchParams.get('reference'),
      searchParams.get('trxref'),
      searchParams.get('transaction_id'),
      searchParams.get('tx_ref'),
      searchParams.get('txref'),
      searchParams.get('provider_reference'),
      searchParams.get('payment_reference'),
      searchParams.get('paystack_reference')
    ];
    
    // Filter out null, empty, or very short values that are likely invalid
    const validRef = possibleRefs.find(ref => ref && ref.trim().length > 10);
    
    console.log('🔍 Payment reference detection:', {
      foundReferences: possibleRefs.filter(r => r),
      selectedReference: validRef,
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    return validRef || null;
  };

  const reference = getPaymentReference();
  const orderIdParam = searchParams.get('order_id');
  const paymentStatus = searchParams.get('status');
  const forceUi = ((searchParams.get('force') || '').toLowerCase() === 'ui');

  // Disabled instant redirect: always verify before navigating
  useEffect(() => {
    // Intentionally left blank to enforce verification-first flow
  }, []);

  // Reference error UI handled after storage fallback in the verification effect

  // Fallback: full verification flow (when status not explicitly success)
  useEffect(() => {
    if (redirected) return;
    // Debug: Log all URL parameters for troubleshooting
    const allParams = Object.fromEntries(searchParams.entries());
    console.log('PaymentCallback - All URL params:', allParams);
    console.log('PaymentCallback - Detected reference:', reference);
    
    // Fallback: try session/local storage if reference is missing (some gateways omit it)
    if (!reference) {
      console.log('PaymentCallback - No reference in URL, checking storage...');
      // Try multiple storage keys in priority order
      const refCandidates = [
        sessionStorage.getItem('paystack_last_reference'),
        localStorage.getItem('paystack_last_reference'),
        sessionStorage.getItem('paymentReference'),
        localStorage.getItem('paymentReference'),
        sessionStorage.getItem('paystack_reference'),
        localStorage.getItem('paystack_reference'),
        sessionStorage.getItem('last_payment_reference'),
        localStorage.getItem('last_payment_reference')
      ];
      const storedRef = refCandidates.find((v) => typeof v === 'string' && v.trim().length > 0) || null;
      console.log('PaymentCallback - Found stored reference:', storedRef);

      // Order details for enriching URL (best-effort)
      const orderDetailsRaw =
        sessionStorage.getItem('orderDetails') ||
        localStorage.getItem('orderDetails') ||
        sessionStorage.getItem('payment_order_details') ||
        localStorage.getItem('payment_order_details');

      let parsedDetails: any = null;
      try { parsedDetails = orderDetailsRaw ? JSON.parse(orderDetailsRaw) : null; } catch {}
      const orderId = parsedDetails?.orderId || parsedDetails?.order_id || null;
      const orderNumber = parsedDetails?.orderNumber || parsedDetails?.order_number || null;

      if (storedRef) {
        const params = new URLSearchParams(window.location.search);
        params.set('reference', storedRef);
        if (orderId) params.set('order_id', orderId);
        if (orderNumber) params.set('order_number', orderNumber);
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

    const trimmedRef = reference?.trim();
    if (trimmedRef) {
      verifyPayment(trimmedRef);
    }
  }, [reference, paymentStatus]);

  const verifyPayment = async (paymentReference: string) => {
    if (verifyingRef.current) return; // double-submit guard
    verifyingRef.current = true;
    try {
      setStatus('verifying');

      // Single definitive call: server completes all DB updates before responding
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference: paymentReference, order_id: orderIdParam }
      });

      if (error || !data?.status) {
        throw new Error((error as any)?.message || data?.error || 'Verification failed');
      }

      const payload = data.data || data;
      const isSuccess = payload?.status === 'success' || payload?.payment_status === 'paid' || data?.success === true;

      if (isSuccess) {
        setStatus('success');
        setResult({
          success: true,
          order_id: payload?.order_id,
          order_number: payload?.order_number,
          amount: typeof payload?.total_amount === 'number'
            ? payload.total_amount
            : (typeof payload?.amount === 'number' ? payload.amount / 100 : undefined),
          message: 'Payment verified successfully! Your order has been confirmed.'
        });

        // Log successful verification
        logPaymentVerification(paymentReference, true);

        // Clear client-side state
        await clearCartAfterPayment(payload?.order_number);
        clearCheckoutState();
        try { sessionStorage.removeItem('paystack_last_reference'); localStorage.removeItem('paystack_last_reference'); } catch {}

        // Emit global payment-confirmed event for listeners
        try {
          window.dispatchEvent(new CustomEvent('payment-confirmed', {
            detail: { orderId: payload?.order_id || orderIdParam, orderReference: paymentReference }
          }));
        } catch {}

        // Friendly toast
        toast.success('Payment confirmed successfully!');

        // Invalidate caches now and again after a short delay for replication safety
        await invalidateOrdersCaches();
        if (refetchOrders) {
          setTimeout(() => { refetchOrders().catch(() => {}); }, 500);
        }
        setTimeout(() => { invalidateOrdersCaches(); }, 2500);

        // Clean the URL to remove sensitive query params
        navigate('/payment/callback', { replace: true });
      } else {
        throw new Error(payload?.gateway_response || 'Payment not successful');
      }
    } catch (err: any) {
      setStatus('failed');
      setResult({
        success: false,
        error: err?.message || 'Verification failed',
        message: 'Unable to verify payment. Please contact support with your payment reference.',
        retryable: false
      });

      // Log failed verification
      logPaymentVerification(paymentReference, false, 1, err?.message);

      // Clean the URL on error as well
      navigate('/payment/callback', { replace: true });
    } finally {
      verifyingRef.current = false;
    }
  };

  // Cache invalidation helper
  const invalidateOrdersCaches = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (orderIdParam) {
        await queryClient.invalidateQueries({ queryKey: ['order', orderIdParam] });
        await queryClient.invalidateQueries({ queryKey: ['orders', orderIdParam] });
      }
      await queryClient.invalidateQueries({ queryKey: ['payment-verification'] });
      await queryClient.invalidateQueries({ queryKey: ['payment'] });
      await queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
    } catch (e) {
      console.warn('Error invalidating caches:', e);
    }
  };

  // Currency formatting
  const formatCurrency = (amount?: number | null) => {
    if (typeof amount !== 'number' || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  // No retry handler needed with single-call verification

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
        return 'Verifying Payment...';
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
        return 'Please wait while we verify your payment...';
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
      <h1 className="sr-only">Paystack Payment Verification</h1>
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
              
              {typeof result.amount === 'number' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">{formatCurrency(result.amount)}</span>
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
