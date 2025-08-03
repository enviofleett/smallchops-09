import { useEffect, useCallback } from 'react';
import { trackCartSession } from '@/api/cartSessions';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export const useCartTracking = (cart: any) => {
  const { customerAccount, user } = useCustomerAuth();

  const getSessionId = useCallback(() => {
    // Get or create a session ID
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  }, []);

  const trackCart = useCallback(async () => {
    if (!cart || !cart.items || cart.items.length === 0) {
      return; // Don't track empty carts
    }

    try {
      const sessionId = getSessionId();
      const totalItems = cart.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const totalValue = cart.summary?.total_amount || 0;

      await trackCartSession({
        sessionId,
        customerId: customerAccount?.id,
        customerEmail: user?.email,
        customerPhone: customerAccount?.phone,
        cartData: cart.items,
        totalItems,
        totalValue
      });
    } catch (error) {
      console.error('Failed to track cart session:', error);
      // Don't throw error to avoid disrupting user experience
    }
  }, [cart, customerAccount, user, getSessionId]);

  // Track cart changes
  useEffect(() => {
    if (cart && cart.items && cart.items.length > 0) {
      // Debounce cart tracking to avoid too many requests
      const timeoutId = setTimeout(trackCart, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [trackCart]);

  // Track on page visibility change (user leaving/returning)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && cart && cart.items && cart.items.length > 0) {
        // User is leaving the page, track cart immediately
        trackCart();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [trackCart]);

  return { trackCart };
};