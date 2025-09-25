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
  
  // Check for immediate success from URL
  const status = searchParams.get('status');
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const isImmediateSuccess = status === 'success' && reference && validateStoredReference(reference);

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
        
        // If we have a reference, try background verification as fallback
        if (reference && validateStoredReference(reference)) {
          console.log('🔄 Attempting background verification despite error status...');
          try {
            const result = await verifySecurePayment(reference, orderId || undefined, { suppressToasts: true });
            if (result.success) {
              console.log('✅ Background verification succeeded despite error status');
              setVerificationStatus('success');
              setOrderDetails({
                orderNumber: (result as any).order_id,
                amount: (result as any).amount,
                reference: reference
              });
              return;
            }
          } catch (bgError) {
            console.warn('⚠️ Background verification also failed:', bgError);
          }
        }
        
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

  // Only show loader if NOT immediate success and still processing
  if ((isProcessing || verificationStatus === 'loading') && !isImmediateSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-3">
        <Card className="w-full max-w-xs p-4 text-center bg-white shadow-lg">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-foreground text-sm">Wait while we confirm your payment</p>
        </Card>
      </div>
    );
  }

  if (verificationStatus === 'success' || isImmediateSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          {/* Success Icon */}
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2">
              <PartyPopper className="h-8 w-8 text-yellow-500 animate-bounce" />
            </div>
          </div>
          
          {/* Success Message */}
          <div>
            <h1 className="text-3xl font-bold text-green-600 mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-600 text-lg">
              Your order has been confirmed
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button 
              onClick={() => navigate('/customer-profile')} 
              className="w-full bg-green-500 hover:bg-green-600 text-white h-12 text-base font-semibold"
            >
              Track Your Order
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full h-12 text-base border-2 border-green-200 text-green-600 hover:bg-green-50 font-semibold"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-3">
      <Card className="w-full max-w-sm p-6 text-center bg-white shadow-lg">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Payment Failed</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {errorMessage || 'There was an issue processing your payment. Please try again.'}
        </p>
        
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/')} 
              className="w-full bg-red-500 hover:bg-red-600 h-10 text-sm"
            >
              Try Again
            </Button>
            <Button 
              onClick={() => navigate('/customer-profile')} 
              variant="outline" 
              className="w-full h-10 text-sm"
            >
              View Orders
            </Button>
          </div>
          
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs text-orange-700">
              <strong>Need help?</strong> Your items are still in your cart. You can try paying again or contact support.
            </p>
          </div>
      </Card>
    </div>
  );
};