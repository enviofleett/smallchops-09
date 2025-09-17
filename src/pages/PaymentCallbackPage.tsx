import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSecurePayment } from '@/hooks/useSecurePayment';
import { cleanupPaymentCache, validateStoredReference } from '@/utils/paymentCacheCleanup';
import { paymentCompletionCoordinator } from '@/utils/paymentCompletion';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import startersLogo from '@/assets/starters-logo.png';

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifySecurePayment, isProcessing } = useSecurePayment();
  const { clearCart } = useCart();
  
  const [verificationStatus, setVerificationStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  // Helper to fetch order amount from database
  const fetchOrderAmount = async (orderId: string) => {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select('total_amount, order_number')
        .eq('id', orderId)
        .single();
      
      if (error) {
        console.warn('Failed to fetch order amount:', error);
        return null;
      }
      
      return order;
    } catch (error) {
      console.warn('Error fetching order amount:', error);
      return null;
    }
  };

  // Enhanced payment callback processing with retry logic
  const processPaymentCallback = async (attempt = 1) => {
    try {
      console.log(`🔍 Processing payment callback... (Attempt ${attempt})`);
      setIsRetrying(attempt > 1);
      
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get('reference') || urlParams.get('trxref');
      const status = urlParams.get('status');
      const errorMessage = urlParams.get('message');
      const orderId = urlParams.get('order_id');
      
      // Handle immediate error from URL
      if (status === 'error') {
        throw new Error(errorMessage || 'Payment failed - please try again');
      }
      
      // Use reference or trxref, whichever is available
      if (!reference) {
        // Try to get from storage as fallback
        const fallbackReference = sessionStorage.getItem('paystack_payment_reference') ||
                                  localStorage.getItem('paystack_last_reference');
        if (!fallbackReference) {
          throw new Error('No payment reference found in URL parameters or storage');
        }
        console.log('✅ Reference recovered from storage:', fallbackReference.substring(0, 20) + '...');
      }

      const paymentReference = reference || sessionStorage.getItem('paystack_payment_reference') || 
                              localStorage.getItem('paystack_last_reference');

      // If URL explicitly says success with valid reference, show success immediately
      if (status === 'success' && paymentReference && validateStoredReference(paymentReference)) {
        console.log('✅ URL indicates success - showing success immediately');
        setVerificationStatus('success');
        
        // Fetch actual order amount immediately
        const orderData = orderId ? await fetchOrderAmount(orderId) : null;
        
        setOrderDetails({
          orderNumber: orderData?.order_number || orderId || 'Processing...',
          amount: orderData?.total_amount || 'Pending confirmation',
          reference: paymentReference
        });
        
        // Handle completion
        paymentCompletionCoordinator.coordinatePaymentCompletion(
          {
            reference: paymentReference,
            orderNumber: orderData?.order_number || orderId,
            amount: orderData?.total_amount
          },
          {
            onClearCart: clearCart,
            onNavigate: () => {
              cleanupPaymentStorage();
              setTimeout(() => navigate('/orders'), 3000);
            }
          }
        );
        return;
      }

      // Verify payment with backend
      const result = await verifySecurePayment(
        paymentReference, 
        orderId || undefined, 
        { suppressToasts: true }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Payment verification failed');
      }

      // Success case
      setVerificationStatus('success');
      setOrderDetails({
        orderNumber: (result as any).order_id || orderId || 'Unknown',
        amount: (result as any).amount || 'Processing...',
        reference: paymentReference
      });
      
      // Handle completion
      paymentCompletionCoordinator.coordinatePaymentCompletion(
        {
          reference: paymentReference,
          orderNumber: (result as any).order_id || orderId,
          amount: (result as any).amount
        },
        {
          onClearCart: clearCart,
          onNavigate: () => {
            cleanupPaymentStorage();
            setTimeout(() => navigate('/orders'), 3000);
          }
        }
      );

    } catch (error: any) {
      console.error(`❌ Payment callback error (Attempt ${attempt}):`, error);
      
      // Retry logic for transient errors
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        setRetryCount(attempt);
        
        setTimeout(() => {
          processPaymentCallback(attempt + 1);
        }, RETRY_DELAY * attempt); // Exponential backoff
        
        return;
      }

      // Final error state
      setVerificationStatus('error');
      setErrorMessage(error.message || 'Payment processing failed');
      setIsRetrying(false);
    }
  };

  // Check if error is retryable
  const isRetryableError = (error: any) => {
    const retryableMessages = [
      'fetch',
      'network',
      'timeout',
      'connection',
      '500',
      '502',
      '503',
      '504',
      'verify-payment',
      'edge function'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some(msg => errorMessage.includes(msg));
  };

  // Clean payment storage
  const cleanupPaymentStorage = () => {
    try {
      sessionStorage.removeItem('paystack_payment_reference');
      sessionStorage.removeItem('payment_order_id');
      localStorage.removeItem('paystack_last_reference');
      console.log('🧹 Payment storage cleaned after success');
    } catch (error) {
      console.warn('⚠️ Failed to clean payment storage:', error);
    }
    cleanupPaymentCache();
  };

  // Manual retry function
  const handleRetry = () => {
    setVerificationStatus('processing');
    setErrorMessage('');
    setRetryCount(0);
    setIsRetrying(false);
    processPaymentCallback();
  };

  useEffect(() => {
    processPaymentCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow-lg border rounded-lg sm:px-10">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src={startersLogo} 
                alt="Starters Logo" 
                className="h-12 w-auto"
              />
            </div>

            {/* Processing State */}
            {verificationStatus === 'processing' && (
              <div className="mb-4">
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Processing Your Payment
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isRetrying 
                    ? `Retrying payment verification... (${retryCount}/${MAX_RETRIES})`
                    : 'Please wait while we confirm your payment...'
                  }
                </p>
                {retryCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Attempt {retryCount} of {MAX_RETRIES}
                  </p>
                )}
              </div>
            )}

            {/* Success State */}
            {verificationStatus === 'success' && (
              <div className="mb-4">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                    <PartyPopper className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-green-600 mb-2">
                  Payment Successful!
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Your payment has been confirmed successfully.
                </p>
                
                {orderDetails && (
                  <div className="bg-muted/50 rounded-lg p-4 mb-4 text-left">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order:</span>
                        <span className="font-medium text-foreground">
                          {orderDetails.orderNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-medium text-foreground">
                          ₦{typeof orderDetails.amount === 'number' 
                            ? orderDetails.amount.toLocaleString() 
                            : orderDetails.amount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reference:</span>
                        <span className="font-mono text-xs text-foreground break-all">
                          {orderDetails.reference}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Redirecting to your orders in a few seconds...
                </p>
              </div>
            )}

            {/* Error State */}
            {verificationStatus === 'error' && (
              <div className="mb-4">
                <div className="flex justify-center mb-4">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-red-600 mb-2">
                  Payment Processing Failed
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {errorMessage || 'There was an issue processing your payment. Please try again.'}
                </p>
                
                <div className="space-y-3">
                  <Button
                    onClick={handleRetry}
                    className="w-full"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      'Retry Payment Verification'
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => navigate('/orders')}
                    className="w-full"
                  >
                    Go to Orders
                  </Button>
                </div>

                {/* Technical Details */}
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 bg-muted/50 p-3 rounded text-left">
                    <p className="break-words">{errorMessage}</p>
                    <p className="mt-1">
                      Time: {new Date().toISOString()}
                    </p>
                    <p>
                      Attempts: {retryCount}/{MAX_RETRIES}
                    </p>
                  </div>
                </details>
              </div>
            )}

            {/* Support Message */}
            <p className="text-xs text-muted-foreground mt-6">
              Need help? Contact our support team if this issue persists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};