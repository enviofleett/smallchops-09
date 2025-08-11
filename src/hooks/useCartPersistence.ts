import { useEffect } from 'react';
import { useCart } from '@/hooks/useCart';

/**
 * Cart persistence hook to prevent premature cart clearing during payment
 */
export const useCartPersistence = () => {
  const { cart } = useCart();

  useEffect(() => {
    // Persist cart during payment flow
    const persistCart = () => {
      if (cart.items.length > 0) {
        const cartData = {
          items: cart.items,
          itemCount: cart.itemCount,
          timestamp: Date.now()
        };
        sessionStorage.setItem('cart_backup', JSON.stringify(cartData));
        console.log('💾 Cart persisted during payment flow');
      }
    };

    // Only persist if payment is in progress
    const paymentInProgress = sessionStorage.getItem('payment_in_progress');
    if (paymentInProgress && cart.items.length > 0) {
      persistCart();
    }

    // Listen for beforeunload to preserve cart
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('payment_in_progress')) {
        persistCart();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cart]);

  const restoreCart = () => {
    try {
      const cartBackup = sessionStorage.getItem('cart_backup');
      if (cartBackup) {
        const cartData = JSON.parse(cartBackup);
        // Check if backup is recent (within 1 hour)
        if (Date.now() - cartData.timestamp < 3600000) {
          console.log('🔄 Restoring cart from backup');
          return cartData;
        }
      }
    } catch (error) {
      console.warn('Failed to restore cart backup:', error);
    }
    return null;
  };

  const clearCartBackup = () => {
    try {
      sessionStorage.removeItem('cart_backup');
      sessionStorage.removeItem('payment_in_progress');
      console.log('✅ Cart backup cleared');
    } catch (error) {
      console.warn('Failed to clear cart backup:', error);
    }
  };

  return {
    restoreCart,
    clearCartBackup
  };
};