import { useEffect, useCallback } from 'react';
import { trackCartSession } from '@/api/cartSessions';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

// Optimized cart tracking with reduced API calls
export const useOptimizedCartTracking = (cart: any) => {
  const { customerAccount, user } = useCustomerAuth();

  const getSessionId = useCallback(() => {
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  }, []);

  const trackCart = useCallback(async () => {
    if (!cart || !cart.items || cart.items.length === 0) {
      return;
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
    }
  }, [cart, customerAccount, user, getSessionId]);

  // Optimized cart tracking - increased debounce time to reduce API calls
  useEffect(() => {
    if (cart && cart.items && cart.items.length > 0) {
      // Increased debounce from 2s to 5s to reduce API calls
      const timeoutId = setTimeout(trackCart, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [trackCart]);

  // Only track on page visibility change (user leaving/returning)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only track when user leaves the page and cart has items
      if (document.visibilityState === 'hidden' && cart && cart.items && cart.items.length > 0) {
        trackCart();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [trackCart]);

  return { trackCart };
};