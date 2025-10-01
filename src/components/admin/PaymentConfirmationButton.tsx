import React, { useState } from 'react';
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
import { CheckCircle, Loader2 } from 'lucide-react';
import { usePaymentConfirmation } from '@/hooks/usePaymentConfirmation';

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
  const { confirmPayment, isConfirming } = usePaymentConfirmation();

  // Only show for pending payments with a reference
  if (paymentStatus !== 'pending' || !paymentReference) {
    return null;
  }

  const handleConfirm = async () => {
    const result = await confirmPayment(orderId, paymentReference, orderNumber);
    
    if (result.success) {
      setShowConfirmDialog(false);
      onSuccess?.();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isConfirming}
        className="gap-2"
      >
        {isConfirming ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            Confirm Payment
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment with Paystack</AlertDialogTitle>
            <AlertDialogDescription>
              This will verify the payment status directly with Paystack for order #{orderNumber}.
              <br /><br />
              <strong>Reference:</strong> {paymentReference}
              <br /><br />
              If the payment is successful, the order will be automatically marked as paid and confirmed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm}
              disabled={isConfirming}
              className="gap-2"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Payment'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
