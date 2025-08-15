import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PaymentProcessingMonitorProps {
  orderNumber?: string;
  reference?: string;
  isProcessing: boolean;
  onProcessingComplete?: (success: boolean, orderData?: any) => void;
}

export const PaymentProcessingMonitor: React.FC<PaymentProcessingMonitorProps> = ({
  orderNumber,
  reference,
  isProcessing,
  onProcessingComplete
}) => {
  const [processingStatus, setProcessingStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    if (!isProcessing || !reference) return;

    let processingInterval: NodeJS.Timeout;
    let statusCheckCount = 0;
    const maxStatusChecks = 30; // Maximum 5 minutes of checking (10 second intervals)

    const checkPaymentStatus = async () => {
      statusCheckCount++;
      
      try {
        // Check if the order has been updated
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            payment_transactions (
              status,
              provider_reference,
              amount,
              paid_at,
              created_at
            )
          `)
          .eq('payment_reference', reference)
          .maybeSingle();

        if (orderError) {
          console.error('Error checking order status:', orderError);
          setProcessingStatus('Error checking payment status...');
          return;
        }

        if (order) {
          setOrderData(order);
          
          // Check payment status
          if (order.payment_status === 'paid') {
            setProcessingStatus('✅ Payment confirmed! Processing complete.');
            clearInterval(processingInterval);
            onProcessingComplete?.(true, order);
            toast.success('Payment confirmed successfully!');
            return;
          } else if (order.payment_status === 'failed') {
            setProcessingStatus('❌ Payment failed.');
            setError('Payment verification failed. Please try again.');
            clearInterval(processingInterval);
            onProcessingComplete?.(false, order);
            toast.error('Payment verification failed');
            return;
          }
          
          // Update status based on current state
          if (order.status === 'pending') {
            setProcessingStatus(`⏳ Verifying payment... (${statusCheckCount}/${maxStatusChecks})`);
          } else if (order.status === 'confirmed') {
            setProcessingStatus('✅ Order confirmed, finalizing payment...');
          }
        } else {
          setProcessingStatus(`🔍 Locating order... (${statusCheckCount}/${maxStatusChecks})`);
        }

        // Timeout after maximum checks
        if (statusCheckCount >= maxStatusChecks) {
          setProcessingStatus('⏰ Processing timeout reached.');
          setError('Payment verification is taking longer than expected. Please check your order status.');
          clearInterval(processingInterval);
          onProcessingComplete?.(false, orderData);
          toast.warning('Payment verification timeout - please check your order status');
        }

      } catch (error) {
        console.error('Error in payment status check:', error);
        setProcessingStatus('❌ Error checking payment status');
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };

    // Start monitoring
    setProcessingStatus('🔄 Starting payment verification...');
    checkPaymentStatus(); // Initial check
    
    // Set up interval for continuous monitoring
    processingInterval = setInterval(checkPaymentStatus, 10000); // Check every 10 seconds

    return () => {
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };
  }, [isProcessing, reference, onProcessingComplete]);

  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Processing Animation */}
          <div className="flex justify-center mb-4">
            {error ? (
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-2xl">❌</span>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            )}
          </div>

          {/* Status Text */}
          <h3 className="text-lg font-semibold mb-2">
            {error ? 'Payment Processing Error' : 'Processing Payment'}
          </h3>
          
          <p className="text-muted-foreground mb-4">
            {error || processingStatus}
          </p>

          {/* Order Details */}
          {orderData && (
            <div className="bg-muted rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between items-center">
                <span>Order:</span>
                <span className="font-medium">{orderData.order_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Amount:</span>
                <span className="font-medium">₦{orderData.total_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="font-medium capitalize">{orderData.payment_status || orderData.status}</span>
              </div>
            </div>
          )}

          {/* Progress Information */}
          {!error && (
            <div className="text-xs text-muted-foreground">
              <p>Please keep this window open while we verify your payment</p>
              <p className="mt-1">Reference: {reference}</p>
            </div>
          )}

          {/* Error Actions */}
          {error && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => window.location.href = '/orders'}
                className="flex-1 px-4 py-2 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
              >
                View Orders
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentProcessingMonitor;