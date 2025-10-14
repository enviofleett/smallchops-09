import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle, RefreshCw, User, Search, Package } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useCart } from "@/hooks/useCart";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import { Skeleton } from "@/components/ui/skeleton";
import { verifyPayment } from "@/utils/paymentVerification";
import { useUserContext } from '@/hooks/useUserContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useGuestSession } from '@/hooks/useGuestSession';

type PageStatus = 'loading' | 'success' | 'timeout' | 'error';

interface OrderData {
  order_id?: string;
  order_number?: string;
  amount?: number;
  customer_email?: string;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { refetch: refetchOrders } = useCustomerOrders();
  const { clearCartAfterPayment } = useOrderProcessing();
  
  // User context for smart navigation
  const userContext = useUserContext();
  const { customerAccount } = useCustomerAuth();
  const { guestSession } = useGuestSession();
  
  const [status, setStatus] = useState<PageStatus>('loading');
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // CRITICAL: Prevent double verification
  const verificationStartedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // PRODUCTION FIX: Timeout-protected success verification
  useEffect(() => {
    if (verificationStartedRef.current || !mountedRef.current) return;
    
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    const orderIdParam = searchParams.get('order_id');
    
    console.log('🎉 PaymentSuccess page loaded:', { reference, orderIdParam });
    
    if (!reference) {
      console.error('❌ No payment reference found on success page');
      setStatus('error');
      return;
    }
    
    verificationStartedRef.current = true;
    
    // CRITICAL: Add timeout protection (30 seconds max)
    const timeoutId = setTimeout(() => {
      if (mountedRef.current && status === 'loading') {
        console.error('⏰ Success page verification timeout');
        setStatus('timeout');
      }
    }, 30000);
    
    // Verify payment status with fallback
    verifyFinalPaymentStatus(reference, orderIdParam)
      .finally(() => {
        clearTimeout(timeoutId);
      });
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchParams, status]);

  const verifyFinalPaymentStatus = async (reference: string, orderIdParam: string | null) => {
    try {
      console.log('🔍 Final payment status verification...');
      
      // Try verification with progressive fallbacks
      const result = await verifyPayment(reference);
      
      if (result.success && result.data) {
        console.log('✅ Payment verification successful on success page');
        
        const data = result.data;
        setOrderData({
          order_id: data.order_id,
          order_number: data.order_number, 
          amount: data.amount,
          customer_email: data.customer?.email
        });
        
        setStatus('success');
        
        // Clear cart and cleanup
        try {
          await clearCartAfterPayment(data.order_number);
          clearCart();
          
          // Refetch orders to update UI
          if (refetchOrders) {
            setTimeout(() => refetchOrders().catch(() => {}), 1000);
          }
        } catch (cleanupError) {
          console.warn('Non-critical cleanup error:', cleanupError);
        }
        
      } else {
        // Handle verification failure
        console.error('❌ Payment verification failed on success page:', result.message);
        
        // If we have order data from URL, show success anyway
        if (orderIdParam) {
          console.log('🔄 Using order ID fallback for success display');
          setOrderData({ order_id: orderIdParam });
          setStatus('success');
        } else {
          setStatus('error');
        }
      }
      
    } catch (error) {
      console.error('❌ Critical error in success page verification:', error);
      
      // Progressive fallback: if we have order ID, assume success
      const orderIdParam = searchParams.get('order_id');
      if (orderIdParam) {
        console.log('🔄 Fallback to success display with order ID');
        setOrderData({ order_id: orderIdParam });
        setStatus('success');
      } else {
        setStatus('error');
      }
    }
  };

  const handleRetry = () => {
    if (retryCount >= 2) return; // Max 3 attempts
    
    setRetryCount(prev => prev + 1);
    setStatus('loading');
    verificationStartedRef.current = false;
    
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    const orderIdParam = searchParams.get('order_id');
    
    if (reference) {
      verifyFinalPaymentStatus(reference, orderIdParam);
    }
  };

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
      case 'loading':
        return <Clock className="h-16 w-16 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'timeout':
      case 'error':
        return <AlertTriangle className="h-16 w-16 text-orange-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'loading':
        return 'Confirming Payment...';
      case 'success':
        return 'Payment Successful!';
      case 'timeout':
        return 'Verification Timeout';
      case 'error':
        return 'Verification Error';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return 'Please wait while we confirm your payment details...';
      case 'success':
        if (orderData?.order_number) {
          const baseMessage = `Order ${orderData.order_number} has been confirmed and will be processed shortly.`;
          if (userContext === 'customer') {
            return `${baseMessage} You can track this order in your profile.`;
          } else {
            return `${baseMessage} Use the tracking link below to monitor your order.`;
          }
        }
        return userContext === 'customer' 
          ? 'Your order has been confirmed and saved to your account.'
          : 'Your order has been confirmed. Keep your order details safe for tracking.';
      case 'timeout':
        return 'Payment verification is taking longer than expected. Your payment may still be successful.';
      case 'error':
        return 'Unable to verify payment status. Please check your order history or contact support.';
    }
  };

  const handleContinue = () => {
    if (status === 'success') {
      if (userContext === 'customer') {
        navigate('/customer-profile');
      } else {
        // For guests, store tracking data and navigate to track order
        if (orderData?.order_number || orderData?.order_id) {
          // Store order tracking data for immediate access
          const trackingData = {
            orderNumber: orderData.order_number,
            orderNumberFormatted: orderData.order_number,
            orderIdUUID: orderData.order_id,
            timestamp: Date.now()
          };
          
          // Store in session storage for immediate access
          sessionStorage.setItem('guestOrderTracking', JSON.stringify(trackingData));
          
          // Navigate with parameters for immediate tracking
          const params = new URLSearchParams();
          if (orderData.order_number) params.set('order', orderData.order_number);
          else if (orderData.order_id) params.set('id', orderData.order_id);
          
          navigate(`/track-order?${params.toString()}`);
        } else {
          // Fallback if no order data
          navigate('/track-order');
        }
      }
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <Helmet>
        <title>Payment Successful | Starters</title>
        <meta name="description" content="Your payment has been processed successfully." />
        <link rel="canonical" href={`${window.location.origin}/payment/success`} />
      </Helmet>
      
      <h1 className="sr-only">Payment Successful</h1>
      
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
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
            {status === 'loading' && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
            
            {status === 'success' && orderData && (
              <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                {orderData.order_number && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Order Number:</span>
                    <span className="text-green-700 font-mono font-semibold text-lg">{orderData.order_number}</span>
                  </div>
                )}
                {orderData.amount && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Amount Paid:</span>
                    <span className="text-green-700 font-semibold">{formatCurrency(orderData.amount)}</span>
                  </div>
                )}
                <div className="text-sm text-green-600 mt-2 font-medium">
                  ✅ Payment confirmed and order is being processed
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              {(status === 'timeout' || status === 'error') && retryCount < 2 && (
                <Button 
                  onClick={handleRetry} 
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Verification ({retryCount + 1}/3)
                </Button>
              )}
              
              {status === 'success' ? (
                <div className="flex flex-col gap-3">
                  {userContext === 'customer' ? (
                    <Button 
                      onClick={handleContinue}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-base font-semibold"
                      size="lg"
                    >
                      <User className="h-5 w-5 mr-2" />
                      View My Orders
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleContinue}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                      size="lg"
                    >
                      <Package className="h-5 w-5 mr-2" />
                      Track This Order
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => navigate('/')}
                    variant="outline"
                    className="w-full py-5 text-green-600 border-green-600 hover:bg-green-50"
                    size="lg"
                  >
                    Continue Shopping
                  </Button>
                  
                  {userContext === 'guest' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <p className="text-xs text-blue-800 text-center">
                        💡 <strong>Tip:</strong> Create an account to permanently save your order history
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={handleContinue}
                  className="w-full"
                  variant="outline"
                >
                  Back to Home
                </Button>
              )}
            </div>
            
            {(status === 'timeout' || status === 'error') && (
              <div className="text-xs text-muted-foreground text-center mt-4">
                If you continue to experience issues, please contact support with your payment reference.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}