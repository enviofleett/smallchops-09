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
import { CheckCircle2, Loader2, Zap, AlertCircle } from 'lucide-react';
import { usePaymentConfirmation } from '@/hooks/usePaymentConfirmation';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

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
    console.log('🔄 Starting payment confirmation for:', {
      orderId,
      orderNumber,
      paymentReference,
      timestamp: new Date().toISOString()
    });
    
    const result = await confirmPayment(orderId, paymentReference, orderNumber);
    
    console.log('✓ Payment confirmation result:', {
      success: result.success,
      orderNumber,
      timestamp: new Date().toISOString()
    });
    
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
        variant="default"
        size="sm"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isConfirming || isRealTimeUpdating}
        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        {isConfirming || isRealTimeUpdating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isRealTimeUpdating ? 'Live Update...' : 'Verifying...'}
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Confirm Payment
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Live Payment Verification
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <div className="text-sm">
                This will verify the payment status directly with <strong>Paystack</strong> in real-time for:
              </div>
              
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Order Number:</span>
                  <Badge variant="outline" className="font-mono">#{orderNumber}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Reference:</span>
                  <code className="text-xs bg-background px-2 py-1 rounded">{paymentReference}</code>
                </div>
              </div>
              
              {isConfirming ? (
                <div className="flex items-center gap-2 text-primary font-semibold bg-primary/10 p-3 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">⚡ Verifying payment with Paystack...</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    If successful, the order will be <strong>immediately confirmed</strong> and marked as paid. 
                    You'll see live updates as each step completes.
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isConfirming || isRealTimeUpdating}>
              Cancel
            </AlertDialogCancel>
            <Button 
              onClick={handleConfirm}
              disabled={isConfirming || isRealTimeUpdating}
              className="gap-2 bg-green-600 hover:bg-green-700 min-w-[140px]"
            >
              {isConfirming || isRealTimeUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRealTimeUpdating ? 'Live Update...' : 'Verifying...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  ✓ Verify Payment
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
