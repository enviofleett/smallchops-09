import { useState } from 'react';
import { verifySecurePayment } from '@/utils/paystackOnly';
import { toast } from 'sonner';

export const usePaymentConfirmation = () => {
  const [isConfirming, setIsConfirming] = useState(false);

  const confirmPayment = async (
    orderId: string,
    reference: string,
    orderNumber: string
  ) => {
    if (!reference) {
      toast.error('No payment reference found for this order');
      return { success: false };
    }

    setIsConfirming(true);
    
    try {
      const result = await verifySecurePayment(reference);
      
      if (result.success && result.status === 'success') {
        toast.success(`Payment confirmed for order #${orderNumber}`);
        return { success: true };
      } else {
        toast.error('Payment verification failed - payment not completed');
        return { success: false };
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to confirm payment');
      return { success: false };
    } finally {
      setIsConfirming(false);
    }
  };

  return {
    confirmPayment,
    isConfirming
  };
};
