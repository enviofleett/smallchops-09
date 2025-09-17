
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { handlePaymentCallback } from '@/utils/paymentVerification';
import { validatePaymentCallback, logValidationResult } from '@/utils/paymentValidation';
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
        // Extract all callback parameters
        const callbackData = {
          reference: searchParams.get('reference') || searchParams.get('trxref'),
          status: searchParams.get('status'),
          order_id: searchParams.get('order_id'),
          order_status: searchParams.get('order_status'),
          payment_status: searchParams.get('payment_status'),
          amount: searchParams.get('amount')
        };

        // Validate callback data using production-ready validation
        const validation = validatePaymentCallback(callbackData);
        logValidationResult(validation, 'Payment Callback');
        
        if (!validation.isValid) {
          setStatus('error');
          setMessage(`Payment data validation failed: ${validation.errors.join(', ')}`);
          console.error('❌ Payment callback validation failed:', validation.errors);
          return;
        }

        const { reference } = validation.sanitizedData;
        if (!reference) {
          setStatus('error');
          setMessage('No payment reference found in callback URL');
          return;
        }

        console.log(`🔄 Processing validated payment callback for reference: ${reference} (attempt ${attemptNumber + 1})`);
        
        if (attemptNumber === 0) {
          setMessage('We\'re verifying your payment... This usually takes just a few seconds.');
        } else {
          setMessage(`Payment gateway is still processing... Attempt ${attemptNumber + 1}/3`);
        }
        
        // Verify the payment
        const verificationResult = await handlePaymentCallback(reference);
        
        if (verificationResult.success) {
          setStatus('success');
          setMessage('🎉 Payment successful! Your order has been confirmed and is being processed.');
          setOrderDetails(verificationResult.data);
          
          toast.success('Payment Confirmed!', {
            description: `Your payment of ₦${verificationResult.data?.amount?.toLocaleString()} has been successfully processed.`,
            duration: 5000
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
                             verificationResult.message?.includes('not found') ||
                             verificationResult.message?.includes('verification failed'));
          
          if (shouldRetry) {
            const delay = 3 + attemptNumber * 2; // 3s, 5s delays
            console.log(`⏳ Retrying verification in ${delay} seconds (attempt ${attemptNumber + 2}/3)...`);
            setMessage(`Payment gateway is still processing... Retrying in ${delay} seconds. This is normal for new transactions.`);
            setIsRetrying(true);
            
            setTimeout(() => {
              setIsRetrying(false);
              handleCallback(attemptNumber + 1);
            }, delay * 1000);
            
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
          description: 'An unexpected error occurred. Please contact support if your payment was charged.'
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
              setMessage('🎉 Payment successful! Your order has been confirmed.');
              setOrderDetails(result.data);
              
              toast.success('Payment Confirmed!', {
                description: `Your payment of ₦${result.data?.amount?.toLocaleString()} has been successfully processed.`
              });
              
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
            setMessage('Retry failed. Please contact support if your payment was charged.');
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
            <p className="text-center text-green-700 font-medium">{message}</p>
            {orderDetails && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800 mb-2">Order Confirmed</h3>
                {orderDetails.order_number && (
                  <p className="text-sm text-green-700">Order: {orderDetails.order_number}</p>
                )}
                {orderDetails.amount && (
                  <p className="text-sm text-green-700 font-semibold">Amount: ₦{orderDetails.amount.toLocaleString()}</p>
                )}
                <p className="text-sm text-green-700 mt-2">✅ Payment confirmed and order is being processed</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center mt-3">
              Redirecting to order confirmation page...
            </p>
          </>
        );
      
      case 'failed':
        return (
          <>
            <h2 className="text-2xl font-semibold text-center text-red-600">Payment Verification Failed</h2>
            <p className="text-center text-red-700">{message}</p>
            <div className="flex gap-2 justify-center mt-4">
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
            <p className="text-center text-orange-700">{message}</p>
            <div className="flex gap-2 justify-center mt-4">
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
