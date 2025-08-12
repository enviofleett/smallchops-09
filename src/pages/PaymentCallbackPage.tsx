import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useSecurePayment } from '@/hooks/useSecurePayment';
import { cleanupPaymentCache, validateStoredReference } from '@/utils/paymentCacheCleanup';

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifySecurePayment, isProcessing } = useSecurePayment();
  
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handlePaymentCallback = async () => {
      console.log('🔍 Processing payment callback...');
      
      // Clean any legacy cache first
      cleanupPaymentCache();
      
      // Extract reference from URL parameters
      const reference = searchParams.get('reference') || searchParams.get('trxref');
      const orderId = searchParams.get('order_id');
      
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
          
          // Clear any remaining payment cache
          setTimeout(() => {
            cleanupPaymentCache();
          }, 1000);
          
        } else {
          console.error('❌ Payment verification failed:', (result as any).error);
          setVerificationStatus('failed');
          setErrorMessage((result as any).error || 'Payment verification failed');
        }
      } catch (error) {
        console.error('❌ Payment verification error:', error);
        setVerificationStatus('failed');
        setErrorMessage(error instanceof Error ? error.message : 'Verification failed');
      }
    };

    handlePaymentCallback();
  }, [searchParams, verifySecurePayment]);

  if (isProcessing || verificationStatus === 'loading') {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifying Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Please wait while we verify your payment...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Payment Successful!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your payment has been processed successfully.
            </p>
            
            {orderDetails && (
              <div className="space-y-2 text-sm">
                <p><strong>Order:</strong> {orderDetails.orderNumber}</p>
                <p><strong>Amount:</strong> ₦{orderDetails.amount?.toLocaleString()}</p>
                <p><strong>Reference:</strong> {orderDetails.reference}</p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate('/orders')} 
                className="flex-1"
              >
                View Orders
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')} 
                className="flex-1"
              >
                Continue Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-red-600">
            <XCircle className="h-6 w-6" />
            Payment Failed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {errorMessage || 'We could not verify your payment.'}
          </p>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => navigate('/cart')} 
              className="flex-1"
            >
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')} 
              className="flex-1"
            >
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};