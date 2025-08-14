import { useEffect, useCallback, useRef } from 'react';
import { trackCartSession } from '@/api/cartSessions';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export const useCartTracking = (cart: any) => {
  const { customerAccount, user } = useCustomerAuth();
  const lastTrackingRef = useRef<string>('');
  const trackingTimeoutRef = useRef<NodeJS.Timeout>();
  const isTrackingRef = useRef<boolean>(false);

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

    // Prevent concurrent tracking calls
    if (isTrackingRef.current) {
      return;
    }

    try {
      isTrackingRef.current = true;
      const sessionId = getSessionId();
      const totalItems = cart.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const totalValue = cart.summary?.total_amount || 0;

      // Create a unique identifier for this cart state to prevent duplicate calls
      const cartStateId = `${sessionId}_${totalItems}_${totalValue}_${cart.items.map((i: any) => `${i.id}_${i.quantity}`).join('|')}`;
      
      // Only track if cart state has changed
      if (lastTrackingRef.current === cartStateId) {
        return;
      }

      lastTrackingRef.current = cartStateId;

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
    } finally {
      isTrackingRef.current = false;
    }
  }, [cart, customerAccount, user, getSessionId]);

  // DISABLED: Track cart changes with heavy debouncing
  useEffect(() => {
    // Clear existing timeout
    if (trackingTimeoutRef.current) {
      clearTimeout(trackingTimeoutRef.current);
    }

    if (cart && cart.items && cart.items.length > 0) {
      // Heavy debounce: only track after 10 seconds of no changes
      trackingTimeoutRef.current = setTimeout(trackCart, 10000);
    }

    return () => {
      if (trackingTimeoutRef.current) {
        clearTimeout(trackingTimeoutRef.current);
      }
    };
  }, [cart?.items?.length, cart?.summary?.total_amount]); // Only track on major changes

  // DISABLED: Track on page visibility change (user leaving/returning)
  // This was causing too many API calls
  /* 
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && cart && cart.items && cart.items.length > 0) {
        trackCart();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [trackCart]);
  */

  return { trackCart };
};