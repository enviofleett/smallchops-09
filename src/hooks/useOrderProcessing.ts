import { useCallback } from 'react';
import { useCart } from './useCart';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useOrderProcessing = () => {
  const { clearCart } = useCart();
  const { toast } = useToast();

  const clearCartAfterPayment = useCallback(async (orderNumber?: string) => {
    try {
      console.log('🛒 Processing cart clear after payment for order:', orderNumber);
      console.log('⏰ Waiting 15 seconds before clearing cart to allow background processes to complete...');
      
      // Show immediate success notification
      toast({
        title: "Payment Successful!",
        description: orderNumber 
          ? `Order ${orderNumber} has been confirmed. Your cart will be cleared in 15 seconds.`
          : "Your payment has been processed successfully. Cart will be cleared in 15 seconds.",
      });
      
      // 🔧 CRITICAL: Wait 15 seconds before clearing cart to prevent race conditions
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      console.log('🛒 15-second delay completed, now clearing cart...');
      
      // Clear cart after delay
      clearCart();
      
      // Show final confirmation
      toast({
        title: "Cart Cleared",
        description: "Your order is being processed. You can track it in your order history.",
      });

      // Clean up any leftover session storage
      localStorage.removeItem('checkout_in_progress');
      localStorage.removeItem('pending_payment_reference');
      
      console.log('🛒 Cart cleared and cleanup completed after 15-second delay');
      
    } catch (error) {
      console.error('Error during cart clearing process:', error);
      // Still clear cart even if notification fails, but with shorter delay
      console.log('⚠️ Error occurred, using 8-second fallback delay...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      clearCart();
    }
  }, [clearCart, toast]);

  const markCheckoutInProgress = useCallback((reference: string) => {
    localStorage.setItem('checkout_in_progress', 'true');
    localStorage.setItem('pending_payment_reference', reference);
    console.log('🛒 Marked checkout as in progress with reference:', reference);
  }, []);

  const isCheckoutInProgress = useCallback(() => {
    return localStorage.getItem('checkout_in_progress') === 'true';
  }, []);

  const clearCheckoutState = useCallback(() => {
    localStorage.removeItem('checkout_in_progress');
    localStorage.removeItem('pending_payment_reference');
    console.log('🛒 Cleared checkout state');
  }, []);

  // Enhanced order status tracking
  const refreshOrderStatus = useCallback(async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total_amount')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Error refreshing order status:', error);
        return null;
      }

      console.log('📋 Refreshed order status:', data);
      return data;
    } catch (error) {
      console.error('Error in refreshOrderStatus:', error);
      return null;
    }
  }, []);

  return {
    clearCartAfterPayment,
    markCheckoutInProgress,
    isCheckoutInProgress,
    clearCheckoutState,
    refreshOrderStatus
  };
};