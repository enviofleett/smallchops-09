import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'error';

interface PaymentResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  amount?: number;
  message?: string;
  error?: string;
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [result, setResult] = useState<PaymentResult | null>(null);

  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');
  const paymentStatus = searchParams.get('status'); // Paystack also sends status

  useEffect(() => {
    // Debug: Log all URL parameters
    console.log('PaymentCallback - All URL params:', Object.fromEntries(searchParams.entries()));
    console.log('PaymentCallback - reference:', reference);
    console.log('PaymentCallback - trxref:', trxref);
    
    if (!reference && !trxref) {
      console.error('PaymentCallback - No payment reference found in URL');
      setStatus('error');
      setResult({
        success: false,
        error: 'No payment reference found',
        message: 'Invalid payment callback URL - missing reference parameter'
      });
      return;
    }

    verifyPayment(reference || trxref!);
  }, [reference, trxref]);

  const verifyPayment = async (paymentReference: string) => {
    try {
      console.log('Verifying payment:', paymentReference);

      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { reference: paymentReference }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('PaymentCallback - Verification response:', data);

      // Check the actual response structure from paystack-verify
      if (data.status && data.data?.status === 'success') {
        setStatus('success');
        setResult({
          success: true,
          order_id: data.data.metadata?.order_id,
          order_number: data.data.metadata?.order_number,
          amount: data.data.amount / 100, // Convert from kobo to naira
          message: 'Payment verified successfully'
        });
      } else {
        setStatus('failed');
        setResult({
          success: false,
          error: data.error || data.data?.gateway_response,
          message: data.message || data.data?.gateway_response || 'Payment verification failed'
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('error');
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to verify payment'
      });
    }
  };

  const getStatusIcon = () => {
    switch (status) {
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
    switch (status) {
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
    if (result?.message) return result.message;
    
    switch (status) {
      case 'verifying':
        return 'Please wait while we verify your payment...';
      case 'success':
        return 'Your order has been confirmed and will be processed shortly.';
      case 'failed':
        return 'Your payment was not successful. Please try again.';
      case 'error':
        return 'There was an error verifying your payment. Please contact support.';
    }
  };

  const handleContinue = () => {
    if (status === 'success') {
      navigate('/customer-portal?tab=orders');
    } else {
      navigate('/cart');
    }
  };

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
          {status === 'verifying' && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {result && status !== 'verifying' && (
            <div className="space-y-3 text-sm">
              {result.order_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Number:</span>
                  <span className="font-medium">{result.order_number}</span>
                </div>
              )}
              
              {result.amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">₦{result.amount.toLocaleString()}</span>
                </div>
              )}

              {reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono text-xs">{reference}</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 space-y-2">
            <Button
              onClick={handleContinue}
              className="w-full"
              disabled={status === 'verifying'}
              variant={status === 'success' ? 'default' : 'outline'}
            >
              {status === 'success' ? 'View Orders' : 'Back to Cart'}
            </Button>
            
            {status !== 'verifying' && status !== 'success' && (
              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                className="w-full"
              >
                Return to Home
              </Button>
            )}
          </div>

          {(status === 'failed' || status === 'error') && (
            <div className="text-center text-sm text-muted-foreground">
              <p>Need help? Contact our support team</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}