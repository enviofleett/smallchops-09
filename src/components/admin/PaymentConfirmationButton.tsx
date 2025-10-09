import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle, Loader2, Zap } from 'lucide-react';
import { usePaymentConfirmation } from '@/hooks/usePaymentConfirmation';
import { supabase } from '@/integrations/supabase/client';

interface PaymentConfirmationButtonProps {
  orderId: string;
  orderNumber: string;
  paymentReference: string | null;
  paymentStatus: string;
  onSuccess?: () => void;
}

export const PaymentConfirmationButton: React.FC<PaymentConfirmationButtonProps> = ({
  orderId,
  orderNumber,
  paymentReference,
  paymentStatus,
  onSuccess
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRealTimeUpdating, setIsRealTimeUpdating] = useState(false);
  const { confirmPayment, isConfirming } = usePaymentConfirmation();

  // Set up real-time listener for this specific order
  useEffect(() => {
    if (!orderId) return;

    console.log('🔔 Setting up real-time listener for order:', orderId);
    
    const channel = supabase
      .channel(`payment-confirmation-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('💳 Payment status updated in real-time:', payload);
          
          const newOrder = payload.new as any;
          
          // Check if payment was confirmed
          if (newOrder.payment_status === 'completed' || newOrder.status === 'confirmed') {
            setIsRealTimeUpdating(true);
            
            // Call success callback after a brief moment
            setTimeout(() => {
              setShowConfirmDialog(false);
              setIsRealTimeUpdating(false);
              onSuccess?.();
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up payment confirmation listener');
      supabase.removeChannel(channel);
    };
  }, [orderId, onSuccess]);

  // Only show for pending payments with a reference
  if (paymentStatus !== 'pending' || !paymentReference) {
    return null;
  }

  const handleConfirm = async () => {
    const result = await confirmPayment(orderId, paymentReference, orderNumber);
    
    if (result.success) {
      // Real-time subscription will handle the UI update
      // But also close dialog immediately if real-time didn't trigger yet
      setTimeout(() => {
        if (!isRealTimeUpdating) {
          setShowConfirmDialog(false);
          onSuccess?.();
        }
      }, 1000);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isConfirming || isRealTimeUpdating}
        className="gap-2"
      >
        {isConfirming || isRealTimeUpdating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isRealTimeUpdating ? 'Updating...' : 'Verifying...'}
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Confirm Payment
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Instant Payment Verification
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will verify the payment status directly with Paystack for order #{orderNumber}.
              <br /><br />
              <strong>Reference:</strong> {paymentReference}
              <br /><br />
              {isConfirming ? (
                <span className="text-primary font-semibold">
                  ⚡ Verifying payment in real-time...
                </span>
              ) : (
                <span>
                  If the payment is successful, the order will be <strong>immediately</strong> marked as paid and confirmed.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming || isRealTimeUpdating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm}
              disabled={isConfirming || isRealTimeUpdating}
              className="gap-2"
            >
              {isConfirming || isRealTimeUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRealTimeUpdating ? 'Updating...' : 'Verifying...'}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Verify Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
