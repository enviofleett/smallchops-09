import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Debug: Log all URL parameters for troubleshooting
    const allParams = Object.fromEntries(searchParams.entries());
    console.log('PaymentCallback - All URL params:', allParams);
    console.log('PaymentCallback - Detected reference:', reference);
    
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

      // Verify payment with backend - enhanced with order details
      const orderId = searchParams.get('order_id');
      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { 
          reference: paymentReference,
          order_id: orderId 
        }
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          throw new Error('Access denied. Please ensure you are logged in and try again.');
        }
        throw new Error(error.message || 'Verification failed');
      }

      console.log('✅ Payment verification response:', { data, error });

      // Enhanced response handling
      if (data?.success) {
        console.log('🎉 Payment verification successful:', data);
        setStatus('success');
        setResult({
          success: true,
          order_id: data.order_id || orderId,
          order_number: data.order_number || orderId,
          amount: data.amount,
          message: 'Payment verified successfully! Your order has been confirmed.'
        });
        
        // Enhanced cart clearing and order refresh
        console.log('🛒 Processing successful payment - clearing cart and refreshing orders');
        await clearCartAfterPayment(data.order_number || orderId);
        clearCheckoutState();
        
        // Refresh orders with retry mechanism
        if (refetchOrders) {
          setTimeout(async () => {
            try {
              await refetchOrders();
              console.log('🔄 Orders refreshed after payment success');
            } catch (refreshError) {
              console.warn('Failed to refresh orders:', refreshError);
            }
          }, 1500);
        }
      } else if (data?.status === true && data?.data) {
        const transactionData = data.data;
        
        if (transactionData.status === 'success') {
          setStatus('success');
          const orderNumber = transactionData.metadata?.order_number;
          setResult({
            success: true,
            order_id: transactionData.metadata?.order_id,
            order_number: orderNumber,
            amount: transactionData.amount / 100, // Convert from kobo to naira
            message: 'Payment verified successfully! Your order has been confirmed.'
          });
          
          // Enhanced cart clearing and order refresh
          console.log('🛒 Processing successful payment - clearing cart and refreshing orders');
          await clearCartAfterPayment(orderNumber);
          clearCheckoutState();
          
          // Refresh orders with retry mechanism
          if (refetchOrders) {
            setTimeout(async () => {
              try {
                await refetchOrders();
                console.log('🔄 Orders refreshed after payment success');
              } catch (refreshError) {
                console.warn('Failed to refresh orders:', refreshError);
              }
            }, 1500);
          }
        } else if (transactionData.status === 'failed' || transactionData.status === 'abandoned') {
          setStatus('failed');
          setResult({
            success: false,
            error: transactionData.gateway_response || 'Payment failed',
            message: transactionData.gateway_response || 'Your payment was not successful. Please try again.',
            retryable: true
          });
        } else {
          // Payment still pending, might need retry
          if (retryCount < maxRetries) {
            console.log(`Payment still pending, retrying in 3 seconds... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              verifyPayment(paymentReference);
            }, 3000);
            return;
          } else {
            setStatus('failed');
            setResult({
              success: false,
              error: 'Payment verification timeout',
              message: 'Unable to verify payment status. Please contact support with your payment reference.',
              retryable: true
            });
          }
        }
      } else {
        throw new Error(data?.error || data?.message || 'Invalid verification response');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      
      // Determine if error is retryable
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = !errorMessage.includes('Access denied') && 
                         !errorMessage.includes('Invalid') && 
                         retryCount < maxRetries;

      if (isRetryable) {
        console.log(`Retrying verification in 5 seconds... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          verifyPayment(paymentReference);
        }, 5000);
        return;
      }

      setStatus('error');
      setResult({
        success: false,
        error: errorMessage,
        message: errorMessage.includes('Access denied') 
          ? 'Please log in to your account and try again.'
          : 'Failed to verify payment. Please contact support if payment was deducted.',
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
      navigate('/customer-portal?tab=orders');
    } else {
      navigate('/cart');
    }
  };

  return (
    <>
      <Helmet>
        <title>Paystack Payment Verification | Starters Small Chops</title>
        <meta name="description" content="Verify your Paystack payment and order status." />
        <link rel="canonical" href={`${window.location.origin}/payment-callback`} />
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