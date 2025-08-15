import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePaymentVerificationV2 } from '@/hooks/usePaymentVerificationV2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { PaymentVerificationResultV2 } from '@/utils/paymentVerificationV2';

interface PaymentCallbackState {
  status: 'verifying' | 'success' | 'failed' | 'error';
  result?: PaymentVerificationResultV2;
  reference?: string;
}

export function PaymentCallbackV2() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyPaymentAndRedirect, retryVerification, isVerifying, verificationError } = usePaymentVerificationV2();
  
  // Get state from navigation or initialize
  const [callbackState, setCallbackState] = useState<PaymentCallbackState>(() => {
    const state = location.state as PaymentCallbackState;
    if (state) return state;
    
    // If no state, check for reference in URL to start verification
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    return {
      status: reference ? 'verifying' : 'error',
      reference: reference || undefined
    };
  });

  // Auto-verify if we have a reference but no result
  useEffect(() => {
    if (callbackState.status === 'verifying' && callbackState.reference && !callbackState.result) {
      verifyPaymentAndRedirect(callbackState.reference);
    }
  }, [callbackState, verifyPaymentAndRedirect]);

  // Update state when navigation state changes
  useEffect(() => {
    const state = location.state as PaymentCallbackState;
    if (state) {
      setCallbackState(state);
    }
  }, [location.state]);

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return 'N/A';
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN' 
    }).format(amount);
  };

  const getStatusIcon = () => {
    switch (callbackState.status) {
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
    switch (callbackState.status) {
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
    if (callbackState.result?.message) return callbackState.result.message;
    if (verificationError) return verificationError;
    
    switch (callbackState.status) {
      case 'verifying':
        return 'Please wait while we verify your payment...';
      case 'success':
        return 'Your order has been confirmed and will be processed shortly.';
      case 'failed':
        return 'Your payment verification encountered an issue.';
      case 'error':
        return 'There was an error processing your payment verification.';
    }
  };

  const handleRetry = () => {
    if (callbackState.reference) {
      retryVerification(callbackState.reference);
      setCallbackState(prev => ({ ...prev, status: 'verifying' }));
    }
  };

  const handleContinue = () => {
    if (callbackState.status === 'success') {
      navigate('/customer-profile');
    } else {
      navigate('/cart');
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <Clock className="h-16 w-16 text-blue-500 animate-spin" />
            </div>
            <CardTitle className="text-2xl">Verifying Payment...</CardTitle>
            <CardDescription>
              Please wait while we verify your payment...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
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
          {callbackState.result && callbackState.status !== 'verifying' && (
            <div className="space-y-3 text-sm">
              {callbackState.result.order?.order_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Number:</span>
                  <span className="font-medium">{callbackState.result.order.order_number}</span>
                </div>
              )}
              
              {callbackState.result.order?.amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">{formatCurrency(callbackState.result.order.amount)}</span>
                </div>
              )}

              {callbackState.reference && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {callbackState.reference.length > 20 
                      ? `${callbackState.reference.substring(0, 20)}...` 
                      : callbackState.reference
                    }
                  </span>
                </div>
              )}

              {callbackState.result.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{callbackState.result.error}</p>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 space-y-2">
            {callbackState.status === 'failed' && callbackState.reference && (
              <Button
                onClick={handleRetry}
                className="w-full"
                variant="outline"
                disabled={isVerifying}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Verification
              </Button>
            )}

            <Button
              onClick={handleContinue}
              className="w-full"
              variant={callbackState.status === 'success' ? 'default' : 'outline'}
            >
              {callbackState.status === 'success' ? 'Continue to Orders' : 'Return to Cart'}
            </Button>

            <Button
              onClick={handleGoHome}
              className="w-full"
              variant="ghost"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}