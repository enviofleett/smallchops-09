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
      
      // Clear cart immediately
      clearCart();
      
      // Show success notification
      toast({
        title: "Order Placed Successfully!",
        description: orderNumber 
          ? `Your order ${orderNumber} has been confirmed and your cart has been cleared.`
          : "Your order has been confirmed and your cart has been cleared.",
      });

      // Clean up any leftover session storage
      localStorage.removeItem('checkout_in_progress');
      localStorage.removeItem('pending_payment_reference');
      
      console.log('🛒 Cart cleared and cleanup completed');
      
    } catch (error) {
      console.error('Error during cart clearing process:', error);
      // Still clear cart even if notification fails
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