
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Loader2, ExternalLink, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaystackPaymentHandlerProps {
  orderId: string;
  amount: number;
  customerEmail: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  // **CRITICAL:** Accept pre-initialized authorization URL
  authorizationUrl?: string;
  disabled?: boolean;
}

export const PaystackPaymentHandler: React.FC<PaystackPaymentHandlerProps> = ({
  orderId,
  amount,
  customerEmail,
  onSuccess,
  onError,
  authorizationUrl, // Use pre-initialized URL
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (disabled) {
      toast.error('Payment is currently disabled');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('💳 PaystackPaymentHandler: Processing payment...', {
        orderId: orderId.substring(0, 8) + '...',
        amount,
        customerEmail: customerEmail.substring(0, 4) + '***',
        hasPreInitializedUrl: !!authorizationUrl
      });

      // **CRITICAL FIX:** Use pre-initialized authorization URL if available
      // This prevents duplicate payment initialization
      if (authorizationUrl) {
        console.log('✅ Using pre-initialized authorization URL from checkout process');
        
        // Open the pre-initialized payment URL
        const paymentWindow = window.open(authorizationUrl, '_blank');
        
        if (!paymentWindow) {
          throw new Error('Please allow popups to complete payment');
        }

        toast.success('Payment window opened', {
          description: 'Complete your payment in the new tab',
          duration: 5000,
        });

        // Call success callback if provided
        if (onSuccess) {
          onSuccess({ 
            success: true, 
            message: 'Payment window opened successfully',
            authorizationUrl 
          });
        }

        return;
      }

      // **FALLBACK:** This should not happen in the enhanced checkout flow
      // But kept for backward compatibility with other payment flows
      console.warn('⚠️ No pre-initialized URL provided - this may cause duplicate initialization');
      
      // Import payment hook only if needed (fallback)
      const { usePayment } = await import('@/hooks/usePayment');
      const { processPayment } = usePayment();
      
      const success = await processPayment(orderId, amount, customerEmail, true);
      
      if (success) {
        toast.success('Payment initiated successfully');
        if (onSuccess) {
          onSuccess({ success: true, message: 'Payment initiated' });
        }
      } else {
        throw new Error('Failed to initiate payment');
      }

    } catch (error) {
      console.error('❌ PaystackPaymentHandler error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed';
      
      toast.error('Payment Error', {
        description: errorMessage,
        duration: 5000,
      });

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <CreditCard className="w-5 h-5" />
          Complete Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total Amount:</span>
          <span className="text-lg font-bold text-blue-800">
            ₦{amount.toLocaleString()}
          </span>
        </div>
        
        {authorizationUrl && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-800 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Payment ready - click below to proceed</span>
            </div>
          </div>
        )}

        <Button
          onClick={handlePayment}
          disabled={disabled || isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Opening Payment...
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4 mr-2" />
              Pay with Paystack
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Secure payment powered by Paystack. You will be redirected to complete your payment.
        </p>
      </CardContent>
    </Card>
  );
};
