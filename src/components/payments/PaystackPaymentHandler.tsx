import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSecurePayment } from '@/hooks/useSecurePayment';
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
  
  const {
    initializeSecurePayment,
    openSecurePayment,
    isLoading,
    isProcessing,
    error,
    reference,
    authorizationUrl,
    resetState
  } = useSecurePayment();

  // Initialize secure payment on mount
  useEffect(() => {
    const initPayment = async () => {
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
      }
    };

    initPayment();
  }, [orderId, amount, email, orderNumber, successUrl, cancelUrl, initializeSecurePayment]);

  const handlePayment = async () => {
    if (!authorizationUrl) {
      onError('No payment URL available');
      return;
    }

    try {
      openSecurePayment(authorizationUrl);
      // Note: onSuccess will be called by the payment callback handler after verification
      toast.info('Payment window opened. Complete payment to continue.');
    } catch (error) {
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
    resetState();
    window.location.reload();
  };

  return (
    <Card className="paystack-payment-handler w-full max-w-lg mx-auto shadow-sm">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-3 text-xl">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">₦</span>
          </div>
          <div className="text-left">
            <p className="font-bold">Secure Payment</p>
            <p className="text-lg font-bold text-primary">₦{amount?.toLocaleString() || '0'}</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button
            onClick={handlePayment}
            disabled={isLoading || isProcessing || !authorizationUrl}
            className="w-full h-14 text-lg font-semibold"
            size="lg"
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                <span>Initializing Secure Payment...</span>
              </div>
            ) : isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                <span>Processing Payment...</span>
              </div>
            ) : (
              `Pay ₦${amount?.toLocaleString() || '0'}`
            )}
          </Button>

          {isLoading && (
            <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              Generating secure payment reference...
            </div>
          )}

          {(isLoading || isProcessing) && (
            <div className="space-y-3 bg-muted/30 rounded-lg p-4">
              <Progress value={isLoading ? 50 : 85} className="w-full h-2" />
              <p className="text-sm text-center text-muted-foreground font-medium">
                {isLoading ? 'Securing payment...' : 'Redirecting to payment gateway...'}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleFallback}
              disabled={!currentReference}
              className="flex-1 h-12"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Alternative
            </Button>
            
            {error && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleRetry}
                className="flex-1 h-12"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>

        <div className="text-xs text-center text-muted-foreground border-t pt-4 space-y-1">
          {currentReference && (
            <p className="font-mono bg-muted/50 rounded px-2 py-1">
              Reference: {currentReference.substring(0, 30)}...
            </p>
          )}
          <p className="font-medium">Order: {orderNumber}</p>
          <div className="flex items-center justify-center gap-1 text-green-600 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Backend-Secured Payment
          </div>
        </div>
      </CardContent>
    </Card>
  );
};