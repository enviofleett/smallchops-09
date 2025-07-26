import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePayment } from '@/hooks/usePayment';
import { useErrorHandler } from '@/hooks/useErrorHandler';

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'cancelled' | 'error';

interface PaymentData {
  status: string;
  amount: number;
  reference: string;
  gateway_response: string;
  channel: string;
  paid_at: string;
  authorization?: {
    authorization_code: string;
    card_type: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    bank: string;
  };
}

const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [countdown, setCountdown] = useState(5);
  const { verifyPayment } = usePayment();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref'); // Alternative parameter name
    const paymentRef = reference || trxref;

    if (paymentRef) {
      verifyTransaction(paymentRef);
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (status === 'success' && countdown === 0) {
      navigate('/orders');
    }
  }, [status, countdown, navigate]);

  const verifyTransaction = async (reference: string) => {
    try {
      setStatus('verifying');
      const verification = await verifyPayment(reference);
      setPaymentData(verification);
      
      switch (verification.status) {
        case 'success':
          setStatus('success');
          break;
        case 'failed':
          setStatus('failed');
          break;
        case 'abandoned':
        case 'cancelled':
          setStatus('cancelled');
          break;
        default:
          setStatus('error');
      }
    } catch (error) {
      console.error('Verification error:', error);
      handleError(error, 'verifying payment');
      setStatus('error');
    }
  };

  const formatAmount = (amount: number) => {
    return `₦${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'verifying':
        return {
          icon: <Loader2 className="h-16 w-16 animate-spin text-primary" />,
          title: 'Verifying Payment',
          message: 'Please wait while we confirm your payment...',
          color: 'text-primary'
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-16 w-16 text-green-500" />,
          title: 'Payment Successful!',
          message: `Your payment has been processed successfully.`,
          color: 'text-green-600'
        };
      case 'failed':
        return {
          icon: <XCircle className="h-16 w-16 text-red-500" />,
          title: 'Payment Failed',
          message: paymentData?.gateway_response || 'Your payment could not be processed.',
          color: 'text-red-600'
        };
      case 'cancelled':
        return {
          icon: <AlertTriangle className="h-16 w-16 text-yellow-500" />,
          title: 'Payment Cancelled',
          message: 'You cancelled the payment process.',
          color: 'text-yellow-600'
        };
      default:
        return {
          icon: <XCircle className="h-16 w-16 text-red-500" />,
          title: 'Error',
          message: 'Something went wrong while processing your payment.',
          color: 'text-red-600'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          {/* Status Icon */}
          <div className="flex justify-center">
            {config.icon}
          </div>

          {/* Title */}
          <h2 className={`text-2xl font-bold ${config.color}`}>
            {config.title}
          </h2>

          {/* Message */}
          <p className="text-muted-foreground">
            {config.message}
          </p>

          {/* Payment Details */}
          {paymentData && status !== 'verifying' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-semibold">
                    {formatAmount(paymentData.amount)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Reference:</span>
                  <span className="text-xs font-mono">
                    {paymentData.reference}
                  </span>
                </div>

                {paymentData.channel && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Method:</span>
                    <Badge variant="secondary" className="capitalize">
                      {paymentData.channel}
                    </Badge>
                  </div>
                )}

                {paymentData.paid_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Paid At:</span>
                    <span className="text-sm">
                      {formatDate(paymentData.paid_at)}
                    </span>
                  </div>
                )}

                {paymentData.authorization && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Card:</span>
                    <span className="text-sm">
                      {paymentData.authorization.card_type} •••• {paymentData.authorization.last4}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            {status === 'success' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Redirecting to your orders in {countdown} seconds...
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/orders')}
                >
                  View Orders
                </Button>
              </>
            )}

            {(status === 'failed' || status === 'cancelled' || status === 'error') && (
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/cart')}
                >
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => navigate('/orders')}
                >
                  View Orders
                </Button>
              </div>
            )}

            {status === 'verifying' && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/')}
              >
                Go Home
              </Button>
            )}
          </div>

          {/* Support Link */}
          {status !== 'success' && status !== 'verifying' && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Need help? Contact our{' '}
                <a href="/support" className="text-primary hover:underline">
                  support team
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCallback;
export { PaymentCallback };