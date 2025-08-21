import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { useSecurePayment } from '@/hooks/useSecurePayment';
import { PaymentRecoveryUtil } from '@/utils/paymentRecovery';
import './payment-styles.css';

interface PaystackPaymentHandlerProps {
  orderId: string;
  amount: number;
  email: string;
  orderNumber: string;
  successUrl?: string;
  cancelUrl?: string;
  onSuccess: (reference: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export const PaystackPaymentHandler = ({
  orderId,
  amount,
  email,
  orderNumber,
  successUrl,
  cancelUrl,
  onSuccess,
  onError,
  onClose,
}: PaystackPaymentHandlerProps) => {
  const [currentReference, setCurrentReference] = useState<string>('');
  const [paymentStartTime, setPaymentStartTime] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const {
    initializeSecurePayment,
    openSecurePayment,
    verifySecurePayment,
    isLoading,
    isProcessing,
    error,
    reference,
    authorizationUrl,
    resetState,
    checkPendingPayment,
    validatePaymentData
  } = useSecurePayment();

  // Check for existing payment on mount
  useEffect(() => {
    const checkExistingPayment = async () => {
      // First check if there's a pending payment
      const pendingPayment = await checkPendingPayment();
      
      if (pendingPayment && pendingPayment.success) {
        onSuccess(pendingPayment.reference || '');
        return;
      }

      // Initialize new payment if no pending payment found
      await initPayment();
    };

    const initPayment = async () => {
      // Validate payment data before initialization
      const validationErrors = validatePaymentData({
        orderId,
        amount,
        customerEmail: email,
        redirectUrl: successUrl,
        metadata: { orderNumber }
      });

      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.map(e => e.message).join(', ');
        onError(errorMessage);
        return;
      }

      const result = await initializeSecurePayment({
        orderId,
        amount,
        customerEmail: email,
        redirectUrl: successUrl || `${window.location.origin}/payment-callback`,
        metadata: {
          orderNumber,
          cancelUrl
        }
      });

      if (result.success && result.reference) {
        setCurrentReference(result.reference);
        setPaymentStartTime(Date.now());
        
        // Store reference and timing for debugging
        sessionStorage.setItem('current_payment_reference', result.reference);
        sessionStorage.setItem('payment_start_time', Date.now().toString());
        sessionStorage.setItem('payment_order_id', orderId);
        
        console.log('🚀 Payment initialized:', {
          reference: result.reference,
          orderId,
          amount,
          email,
          timestamp: new Date().toISOString()
        });
        
        // Enhanced payment data storage with recovery utility
        PaymentRecoveryUtil.storePaymentData({
          reference: result.reference,
          orderId,
          amount,
          email
        });
      }
    };

    checkExistingPayment();
  }, [orderId, amount, email, orderNumber, successUrl, cancelUrl, initializeSecurePayment, checkPendingPayment, validatePaymentData, onSuccess, onError]);

  const handlePayment = async () => {
    if (!authorizationUrl) {
      onError('No payment URL available');
      return;
    }

    try {
      console.log('🔄 Redirecting to payment gateway:', {
        reference: currentReference,
        authorizationUrl: authorizationUrl.substring(0, 50) + '...',
        duration_ms: paymentStartTime ? Date.now() - paymentStartTime : 0
      });
      
      window.location.href = authorizationUrl;
      toast.info('Redirecting to secure Paystack checkout...');
    } catch (error) {
      console.error('❌ Payment redirect failed:', error);
      onError(error instanceof Error ? error.message : 'Payment failed');
    }
  };

  const handleFallback = () => {
    if (!authorizationUrl) {
      onError('Payment not ready. Please try again.');
      return;
    }
    
    // Use the same secure authorizationUrl for alternative payment
    window.open(authorizationUrl, '_blank');
    toast.info('Payment opened in new tab');
  };

  const handleRetry = () => {
    PaymentRecoveryUtil.clearStoredData();
    resetState();
    window.location.reload();
  };

  const handleClose = () => {
    const storedReference = sessionStorage.getItem('current_payment_reference');
    const startTime = sessionStorage.getItem('payment_start_time');
    
    console.log('🔍 Payment popup/flow closed:', {
      storedReference,
      currentReference,
      duration_ms: startTime ? Date.now() - parseInt(startTime) : 0
    });
    
    // Check for pending payment after a short delay
    setTimeout(async () => {
      const pendingPayment = await checkPendingPayment();
      if (pendingPayment && pendingPayment.success) {
        console.log('✅ Found completed payment after close:', pendingPayment.reference);
        onSuccess(pendingPayment.reference || '');
      } else {
        onClose();
      }
    }, 2000);
  };

  // Enhanced error handling with retry logic
  useEffect(() => {
    if (error && currentReference && retryCount < 3) {
      const isReferenceNotFound = error.toLowerCase().includes('reference not found') || 
                                 error.toLowerCase().includes('transaction not found');
      
      if (isReferenceNotFound) {
        console.log(`🔄 "Reference not found" error detected, scheduling retry ${retryCount + 1}/3 in 3s...`);
        
        PaymentRecoveryUtil.showUserFriendlyError(
          'We couldn\'t find your payment yet. This can happen when the gateway is still processing. Retrying now…'
        );
        
        setTimeout(async () => {
          setRetryCount(prev => prev + 1);
          
          try {
            const pendingPayment = await checkPendingPayment();
            if (pendingPayment && pendingPayment.success) {
              console.log('✅ Retry successful:', pendingPayment.reference);
              onSuccess(pendingPayment.reference || '');
              return;
            }
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError);
          }
        }, 3000 + Math.random() * 2000); // 3-5s with jitter
      }
    }
  }, [error, currentReference, retryCount, checkPendingPayment, onSuccess]);

  return (
    <Card className="paystack-payment-handler w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Secure Payment</span>
          <Badge variant="outline" className="text-xs">
            ₦{amount?.toLocaleString() || '0'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            onClick={handlePayment}
            disabled={isLoading || isProcessing || !authorizationUrl}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Initializing Secure Payment...
              </div>
            ) : isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Processing Payment...
              </div>
            ) : (
              `Pay ₦${amount?.toLocaleString() || '0'}`
            )}
          </Button>

          {isLoading && (
            <div className="text-center text-sm text-muted-foreground">
              Generating secure payment reference...
            </div>
          )}

          {(isLoading || isProcessing) && (
            <div className="space-y-2">
              <Progress value={isLoading ? 50 : 85} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {isLoading ? 'Securing payment...' : 'Redirecting to payment gateway...'}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFallback}
              disabled={!currentReference}
              className="flex-1"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Alternative
            </Button>
            
            {error && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>

        <div className="text-xs text-center text-muted-foreground border-t pt-3">
          {currentReference && (
            <p>Reference: {currentReference.substring(0, 30)}...</p>
          )}
          <p>Order: {orderNumber}</p>
          <p className="text-green-600 font-medium">✅ Backend-Secured Payment</p>
        </div>
      </CardContent>
    </Card>
  );
};