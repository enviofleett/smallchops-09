import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { handlePaymentCallback } from '@/utils/paymentVerification';
import { toast } from 'sonner';

export const PaymentCallbackHandler: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async (attemptNumber = 0) => {
      try {
        // Get reference from URL params (prefer reference over trxref)
        const reference = searchParams.get('reference') || searchParams.get('trxref');
        
        if (!reference) {
          setStatus('error');
          setMessage('No payment reference found in callback URL');
          return;
        }

        // Log if using trxref instead of reference
        if (searchParams.get('trxref') && !searchParams.get('reference')) {
          console.warn('🚨 Using trxref instead of reference - possible callback URL misconfiguration');
        }

        console.log(`🔄 Processing payment callback for reference: ${reference} (attempt ${attemptNumber + 1})`);
        
        if (attemptNumber === 0) {
          setMessage('We\'re verifying your payment... This can take a few seconds.');
        }
        
        // Verify the payment
        const verificationResult = await handlePaymentCallback(reference);
        
        if (verificationResult.success) {
          setStatus('success');
          setMessage('Payment successful! Your order has been confirmed.');
          setOrderDetails(verificationResult.data);
          
          toast.success('Payment Successful!', {
            description: `Your payment of ₦${verificationResult.data?.amount?.toLocaleString()} has been confirmed.`
          });
          
          // Redirect to success page after delay
          setTimeout(() => {
            if (verificationResult.data?.order_id) {
              navigate(`/order-success?ref=${reference}&order_id=${verificationResult.data.order_id}`);
            } else {
              navigate(`/order-success?ref=${reference}`);
            }
          }, 3000);
          
        } else {
          // Check if this is a "transaction not found" error that we should retry
          const shouldRetry = attemptNumber < 2 && 
                            (verificationResult.message?.includes('Transaction reference not found') ||
                             verificationResult.message?.includes('not found'));
          
          if (shouldRetry) {
            console.log(`⏳ Retrying verification in ${3 + attemptNumber * 2} seconds (attempt ${attemptNumber + 2}/3)...`);
            setMessage(`Payment gateway is still processing... Retrying in ${3 + attemptNumber * 2} seconds.`);
            setIsRetrying(true);
            
            setTimeout(() => {
              setIsRetrying(false);
              handleCallback(attemptNumber + 1);
            }, (3 + attemptNumber * 2) * 1000);
            
          } else {
            setStatus('failed');
            setMessage(verificationResult.message || 'Payment verification failed');
            
            toast.error('Payment Verification Failed', {
              description: verificationResult.message || 'Unable to verify your payment'
            });
          }
        }
        
      } catch (error) {
        console.error('❌ Callback handling error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your payment');
        
        toast.error('Payment Processing Error', {
          description: 'An unexpected error occurred. Please contact support.'
        });
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  const handleRetry = async () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setStatus('loading');
      setMessage('Retrying payment verification...');
      setIsRetrying(true);
      
      // Use internal retry instead of window.reload
      setTimeout(() => {
        const reference = searchParams.get('reference') || searchParams.get('trxref');
        if (reference) {
          handlePaymentCallback(reference).then(result => {
            setIsRetrying(false);
            if (result.success) {
              setStatus('success');
              setMessage('Payment successful! Your order has been confirmed.');
              setOrderDetails(result.data);
              
              setTimeout(() => {
                if (result.data?.order_id) {
                  navigate(`/order-success?ref=${reference}&order_id=${result.data.order_id}`);
                } else {
                  navigate(`/order-success?ref=${reference}`);
                }
              }, 2000);
            } else {
              setStatus('failed');
              setMessage(result.message || 'Payment verification failed');
            }
          }).catch(() => {
            setIsRetrying(false);
            setStatus('error');
            setMessage('Retry failed. Please contact support.');
          });
        }
      }, 2000);
    } else {
      toast.error('Maximum retries exceeded', {
        description: 'Please contact support for assistance.'
      });
    }
  };

  const renderIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'failed':
        return <XCircle className="h-16 w-16 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-16 w-16 text-orange-500" />;
      default:
        return <Loader2 className="h-16 w-16 text-primary animate-spin" />;
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <h2 className="text-2xl font-semibold text-center">Verifying Payment</h2>
            <p className="text-muted-foreground text-center">
              {isRetrying 
                ? 'Retrying verification... Payment gateways can take a few moments to process.'
                : message || 'Please wait while we verify your payment...'
              }
            </p>
          </>
        );
      
      case 'success':
        return (
          <>
            <h2 className="text-2xl font-semibold text-center text-green-600">Payment Successful!</h2>
            <p className="text-center">{message}</p>
            {orderDetails && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800">Order Details</h3>
                {orderDetails.order_number && (
                  <p className="text-sm text-green-700">Order: {orderDetails.order_number}</p>
                )}
                {orderDetails.amount && (
                  <p className="text-sm text-green-700">Amount: ₦{orderDetails.amount.toLocaleString()}</p>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Redirecting to order confirmation...
            </p>
          </>
        );
      
      case 'failed':
        return (
          <>
            <h2 className="text-2xl font-semibold text-center text-red-600">Payment Verification Failed</h2>
            <p className="text-center">{message}</p>
            <div className="flex gap-2 justify-center">
              {retryCount < 3 && (
                <Button onClick={handleRetry} variant="outline">
                  Retry Verification ({3 - retryCount} left)
                </Button>
              )}
              <Button onClick={() => navigate('/')} variant="default">
                Return to Home
              </Button>
            </div>
          </>
        );
      
      case 'error':
        return (
          <>
            <h2 className="text-2xl font-semibold text-center text-orange-600">Processing Error</h2>
            <p className="text-center">{message}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate('/contact')} variant="outline">
                Contact Support
              </Button>
              <Button onClick={() => navigate('/')} variant="default">
                Return to Home
              </Button>
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {renderIcon()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};