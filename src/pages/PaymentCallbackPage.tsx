import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, PartyPopper } from 'lucide-react';
import { useSecurePayment } from '@/hooks/useSecurePayment';
import { cleanupPaymentCache, validateStoredReference } from '@/utils/paymentCacheCleanup';
import { paymentCompletionCoordinator } from '@/utils/paymentCompletion';
import { useCart } from '@/hooks/useCart';
import startersLogo from '@/assets/starters-logo.png';

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifySecurePayment, isProcessing } = useSecurePayment();
  const { clearCart } = useCart();
  
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handlePaymentCallback = async () => {
      console.log('🔍 Processing payment callback...');
      
      // Check if this is an error callback first
      const status = searchParams.get('status');
      const errorMessage = searchParams.get('message');
      
      if (status === 'error') {
        console.error('❌ Payment callback received error status:', errorMessage);
        setVerificationStatus('failed');
        setErrorMessage(decodeURIComponent(errorMessage || 'Payment processing failed'));
        return;
      }
      
      // Extract reference from multiple sources with fallback chain
      let reference = searchParams.get('reference') || searchParams.get('trxref');
      const orderId = searchParams.get('order_id');
      
      // Fallback chain if reference not in URL
      if (!reference) {
        console.log('🔍 Reference not in URL, checking storage...');
        try {
          reference = sessionStorage.getItem('paystack_payment_reference') ||
                     localStorage.getItem('paystack_last_reference') ||
                     sessionStorage.getItem('paymentReference') ||
                     localStorage.getItem('paymentReference');
          
          if (reference) {
            console.log('✅ Reference recovered from storage:', reference.substring(0, 20) + '...');
          }
        } catch (error) {
          console.warn('⚠️ Failed to access storage for reference recovery:', error);
        }
      }
      
      // Clean any legacy cache AFTER getting reference
      cleanupPaymentCache();
      
      if (!reference) {
        console.error('❌ No payment reference found in callback URL');
        setVerificationStatus('failed');
        setErrorMessage('Invalid payment callback - no reference found');
        return;
      }
      
      // Validate reference format
      if (!validateStoredReference(reference)) {
        console.error('🚨 Invalid reference format in callback:', reference);
        setVerificationStatus('failed');
        setErrorMessage('Invalid payment reference format');
        return;
      }
      
      console.log('✅ Valid reference found:', reference);
      
      try {
        // Verify the payment
        const result = await verifySecurePayment(reference, orderId || undefined);
        
        if (result.success) {
          console.log('✅ Payment verification successful');
          setVerificationStatus('success');
          setOrderDetails({
            orderNumber: (result as any).order_id,
            amount: (result as any).amount,
            reference: (result as any).reference
          });
          
          // Notify parent window (if opened from checkout dialog)
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ 
              type: 'PAYMENT_SUCCESS', 
              orderId: (result as any).order_id,
              reference: reference
            }, window.location.origin);
          }

          // Use payment completion coordinator for cart clearing with 15-second delay
          paymentCompletionCoordinator.coordinatePaymentCompletion(
            {
              reference: reference,
              orderNumber: (result as any).order_id,
              amount: (result as any).amount
            },
            {
              onClearCart: clearCart,
              onNavigate: () => {
                // Clean up payment storage after successful verification
                try {
                  sessionStorage.removeItem('paystack_payment_reference');
                  sessionStorage.removeItem('payment_order_id');
                  localStorage.removeItem('paystack_last_reference');
                  console.log('🧹 Payment storage cleaned after success');
                } catch (error) {
                  console.warn('⚠️ Failed to clean payment storage:', error);
                }
                cleanupPaymentCache();
              }
            }
          );
          
        } else {
          console.error('❌ Payment verification failed:', (result as any).error);
          setVerificationStatus('failed');
          setErrorMessage((result as any).error || 'Payment verification failed');
          
          // DON'T clear cart on failure - user should be able to retry
          console.log('🛒 Cart preserved for retry - not clearing on failure');
          
          // Notify parent window of failure (if opened from checkout dialog)
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ 
              type: 'PAYMENT_FAILED', 
              error: (result as any).error || 'Payment verification failed'
            }, window.location.origin);
          }
        }
      } catch (error) {
        console.error('❌ Payment verification error:', error);
        setVerificationStatus('failed');
        setErrorMessage(error instanceof Error ? error.message : 'Verification failed');
        
        // DON'T clear cart on error - user should be able to retry
        console.log('🛒 Cart preserved for retry - not clearing on error');
        
        // Notify parent window of failure (if opened from checkout dialog)
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ 
            type: 'PAYMENT_FAILED', 
            error: error instanceof Error ? error.message : 'Verification failed'
          }, window.location.origin);
        }
      }
    };

    handlePaymentCallback();
  }, [searchParams, verifySecurePayment]);

  if (isProcessing || verificationStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        {/* Header with Logo */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-center">
            <img src={startersLogo} alt="Starters" className="h-12 object-contain" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-8 text-center bg-white">
            <Loader2 className="h-16 w-16 animate-spin text-orange-500 mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex flex-col">
        {/* Header with Logo */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-center">
            <img src={startersLogo} alt="Starters" className="h-12 object-contain" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-6">
            {/* Success Icon */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-green-600 mb-2 flex items-center justify-center gap-2">
                Payment Successful! <PartyPopper className="h-6 w-6" />
              </h1>
              <p className="text-muted-foreground text-sm px-4">
                Your order has been confirmed and is being processed
              </p>
            </div>

            {/* Amount Display */}
            <Card className="p-6 bg-green-500 text-white text-center">
              <p className="text-green-100 text-sm mb-2">Total Amount</p>
              <p className="text-3xl font-bold">₦{orderDetails?.amount?.toLocaleString()}</p>
            </Card>

            {/* Status */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Order Confirmed & Processing</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/customer-profile')} 
                className="w-full bg-green-500 hover:bg-green-600 text-white h-12 text-base font-medium"
              >
                Track Your Order
              </Button>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline" 
                className="w-full h-12 text-base border-green-200 text-green-600 hover:bg-green-50"
              >
                Continue Shopping
              </Button>
            </div>

            {/* Order Complete Section */}
            <Card className="p-4 bg-white border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">Order Complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your order is being processed. Check your order history for updates.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex flex-col">
      {/* Header with Logo */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <img src={startersLogo} alt="Starters" className="h-12 object-contain" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-8 text-center bg-white">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {errorMessage ? (
              errorMessage.toLowerCase().includes('timeout') ? (
                'Payment verification is taking longer than expected. Your payment may still be processing.'
              ) : errorMessage.toLowerCase().includes('temporarily unavailable') ? (
                'Our payment service is temporarily unavailable. Please try again in a few moments.'
              ) : (
                errorMessage
              )
            ) : (
              'There was an issue processing your payment. Please try again.'
            )}
          </p>
          
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/')} 
                className="w-full bg-red-500 hover:bg-red-600 h-12 text-base"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => navigate('/customer-profile')} 
                variant="outline" 
                className="w-full h-12 text-base"
              >
                View Orders
              </Button>
            </div>
            
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700">
                <strong>Need help?</strong> {
                  errorMessage?.toLowerCase().includes('timeout') ? (
                    'If your bank has charged you, the payment will be processed automatically. Check your order status in a few minutes.'
                  ) : errorMessage?.toLowerCase().includes('temporarily unavailable') ? (
                    'Your items are saved in your cart. You can try paying again in a few minutes.'
                  ) : (
                    'Your items are still in your cart. You can try paying again or contact support.'
                  )
                }
              </p>
            </div>
        </Card>
      </div>
    </div>
  );
};