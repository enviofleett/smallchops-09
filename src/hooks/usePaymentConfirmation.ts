import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { verifySecurePayment } from '@/utils/paystackOnly';
import { toast } from 'sonner';

export const usePaymentConfirmation = () => {
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();

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
    
    // Show optimistic update toast immediately
    const optimisticToast = toast.loading(`Verifying payment for order #${orderNumber}...`);
    
    try {
      // Optimistically update the order in cache
      queryClient.setQueriesData(
        { queryKey: ['orders-list'] },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          
          return oldData.map((order: any) => 
            order.id === orderId 
              ? { 
                  ...order, 
                  payment_status: 'completed',
                  status: 'confirmed',
                  _optimistic: true
                }
              : order
          );
        }
      );

      // Verify payment with Paystack
      const result = await verifySecurePayment(reference);
      
      if (result.success && result.status === 'success') {
        // Dismiss optimistic toast and show success
        toast.dismiss(optimisticToast);
        toast.success(`✅ Payment confirmed for order #${orderNumber}`, {
          duration: 5000,
          description: 'Order status updated to confirmed'
        });
        
        // Force immediate refetch of all order-related queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['orders-list'] }),
          queryClient.invalidateQueries({ queryKey: ['admin-orders-polling'] }),
          queryClient.invalidateQueries({ queryKey: ['orders'] }),
          queryClient.refetchQueries({ queryKey: ['orders-list'], type: 'active' })
        ]);
        
        return { success: true };
      } else {
        // Revert optimistic update on failure
        queryClient.invalidateQueries({ queryKey: ['orders-list'] });
        
        toast.dismiss(optimisticToast);
        toast.error('Payment verification failed - payment not completed', {
          description: result.status ? `Status: ${result.status}` : 'Please try again'
        });
        return { success: false };
      }
    } catch (error) {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      
      console.error('Payment confirmation error:', error);
      toast.dismiss(optimisticToast);
      toast.error(error instanceof Error ? error.message : 'Failed to confirm payment', {
        description: 'Please try again or contact support'
      });
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
