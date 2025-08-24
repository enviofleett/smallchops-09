import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, PartyPopper } from 'lucide-react';
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
  
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

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

  useEffect(() => {
    const handlePaymentCallback = async () => {
      console.log('🔍 Processing payment callback...');
      
      // Check URL parameters
      const status = searchParams.get('status');
      const errorMessage = searchParams.get('message');
      const reference = searchParams.get('reference') || searchParams.get('trxref');
      const orderId = searchParams.get('order_id');
      
      // If URL explicitly says success with valid reference, show success immediately
      if (status === 'success' && reference && validateStoredReference(reference)) {
        console.log('✅ URL indicates success - showing success immediately');
        setVerificationStatus('success');
        
        // Fetch actual order amount immediately
        const orderData = orderId ? await fetchOrderAmount(orderId) : null;
        
        setOrderDetails({
          orderNumber: orderData?.order_number || orderId || 'Processing...',
          amount: orderData?.total_amount || 'Pending confirmation',
          reference: reference
        });
        
        // Run verification in background to confirm and get details
        try {
          const result = await verifySecurePayment(reference, orderId || undefined, { suppressToasts: true });
          if (result.success) {
            console.log('✅ Background verification confirmed success');
            setOrderDetails(prev => ({
              ...prev,
              orderNumber: (result as any).order_id || prev.orderNumber,
              amount: (result as any).amount || prev.amount,
              reference: reference
            }));
            
            // Handle cart clearing and notifications
            paymentCompletionCoordinator.coordinatePaymentCompletion(
              {
                reference: reference,
                orderNumber: (result as any).order_id || orderId,
                amount: (result as any).amount
              },
              {
                onClearCart: clearCart,
                onNavigate: () => {
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
            console.warn('⚠️ Background verification failed, but keeping success UI (URL authority)');
          }
        } catch (error) {
          console.warn('⚠️ Background verification error, but keeping success UI (URL authority):', error);
        }
        return;
      }
      
      // Check if this is an error callback
      if (status === 'error') {
        console.error('❌ Payment callback received error status:', errorMessage);
        setVerificationStatus('failed');
        setErrorMessage(decodeURIComponent(errorMessage || 'Payment processing failed'));
        return;
      }
      
      // Extract reference from multiple sources with fallback chain (if not already extracted)
      let fallbackReference = reference || searchParams.get('reference') || searchParams.get('trxref');
      const fallbackOrderId = orderId || searchParams.get('order_id');
      
      // Fallback chain if reference not in URL
      if (!fallbackReference) {
        console.log('🔍 Reference not in URL, checking storage...');
        try {
          fallbackReference = sessionStorage.getItem('paystack_payment_reference') ||
                     localStorage.getItem('paystack_last_reference') ||
                     sessionStorage.getItem('paymentReference') ||
                     localStorage.getItem('paymentReference');
          
          if (fallbackReference) {
            console.log('✅ Reference recovered from storage:', fallbackReference.substring(0, 20) + '...');
          }
        } catch (error) {
          console.warn('⚠️ Failed to access storage for reference recovery:', error);
        }
      }
      
      // Clean any legacy cache AFTER getting reference
      cleanupPaymentCache();
      
      if (!fallbackReference) {
        console.error('❌ No payment reference found in callback URL');
        setVerificationStatus('failed');
        setErrorMessage('Invalid payment callback - no reference found');
        return;
      }
      
      // Validate reference format
      if (!validateStoredReference(fallbackReference)) {
        console.error('🚨 Invalid reference format in callback:', fallbackReference);
        setVerificationStatus('failed');
        setErrorMessage('Invalid payment reference format');
        return;
      }
      
      console.log('✅ Valid reference found:', fallbackReference);
      
      try {
        // Verify the payment
        const result = await verifySecurePayment(fallbackReference, fallbackOrderId || undefined, { suppressToasts: true });
        
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
              reference: fallbackReference
            }, window.location.origin);
          }

          // Use payment completion coordinator for cart clearing with 15-second delay
          paymentCompletionCoordinator.coordinatePaymentCompletion(
            {
              reference: fallbackReference,
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex flex-col relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-red-100/30 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-orange-100/20 rounded-full blur-2xl"></div>
        </div>

        {/* Header with Prominent Logo */}
        <div className="bg-white shadow-lg border-b-2 border-red-100 relative z-10">
          <div className="container mx-auto px-4 py-6 flex items-center justify-center">
            <div className="text-center">
              <img src={startersLogo} alt="Starters" className="h-16 object-contain mx-auto mb-2" />
              <p className="text-red-600 font-medium text-sm">Order Management System</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-md space-y-6">
            {/* Success Icon with Animation */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-28 h-28 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-red-50">
                  <CheckCircle className="h-14 w-14 text-red-600" />
                </div>
                <div className="absolute -top-2 -right-2">
                  <PartyPopper className="h-8 w-8 text-orange-500 animate-bounce" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-red-600 mb-3">
                Payment Successful!
              </h1>
              <p className="text-gray-600 text-base px-4 leading-relaxed">
                Your order has been confirmed and is being processed
              </p>
            </div>

            {/* Amount Display with Enhanced Design */}
            <Card className="p-8 bg-gradient-to-r from-red-500 to-red-600 text-white text-center shadow-xl border-0">
              <p className="text-red-100 text-base mb-3 font-medium">Total Amount</p>
              <p className="text-4xl font-bold tracking-wide">
                {typeof orderDetails?.amount === 'number' 
                  ? `₦${orderDetails.amount.toLocaleString()}` 
                  : orderDetails?.amount === 'Pending confirmation' 
                    ? 'Pending confirmation' 
                    : 'Processing...'}
              </p>
            </Card>

            {/* Enhanced Status */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-5 text-center shadow-sm">
              <div className="flex items-center justify-center gap-3 text-red-700">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-base font-semibold">Order Confirmed & Processing</span>
              </div>
            </div>

            {/* Action Buttons with Better Styling */}
            <div className="space-y-4">
              <Button 
                onClick={() => navigate('/customer-profile')} 
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white h-14 text-lg font-semibold shadow-lg transform hover:scale-[1.02] transition-all duration-200"
              >
                Track Your Order
              </Button>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline" 
                className="w-full h-14 text-lg border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold transform hover:scale-[1.02] transition-all duration-200"
              >
                Continue Shopping
              </Button>
            </div>

            {/* Order Complete Section with Better Design */}
            <Card className="p-6 bg-white border-2 border-gray-100 shadow-lg rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2 text-lg">Order Complete!</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Order {orderDetails?.orderNumber || 'Processing...'} is being processed. You can track it in your order history.
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
            {errorMessage || 'There was an issue processing your payment. Please try again.'}
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
                <strong>Need help?</strong> Your items are still in your cart. You can try paying again or contact support.
              </p>
            </div>
        </Card>
      </div>
    </div>
  );
};