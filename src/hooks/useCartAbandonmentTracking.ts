import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseCartAbandonmentTrackingOptions {
  sessionId?: string;
  customerEmail?: string;
  customerId?: string;
  enabled?: boolean;
}

export const useCartAbandonmentTracking = (options: UseCartAbandonmentTrackingOptions = {}) => {
  const { sessionId, customerEmail, customerId, enabled = true } = options;

  // Track cart updates
  const trackCartUpdate = useCallback(async (cartData: any[], totalValue: number) => {
    if (!enabled || !sessionId) return;

    try {
      console.log('Tracking cart update:', { 
        sessionId, 
        itemCount: cartData.length, 
        totalValue 
      });

      // Call the cart abandonment processor to track this cart
      const { error } = await supabase.functions.invoke('cart-abandonment-processor', {
        body: {
          session_id: sessionId,
          customer_email: customerEmail,
          customer_id: customerId,
          cart_data: cartData,
          total_value: totalValue
        }
      });

      if (error) {
        console.error('Failed to track cart update:', error);
      }
    } catch (error) {
      console.error('Error tracking cart update:', error);
    }
  }, [sessionId, customerEmail, customerId, enabled]);

  // Mark cart as recovered (when order is completed)
  const markCartRecovered = useCallback(async () => {
    if (!enabled || !sessionId) return;

    try {
      console.log('Marking cart as recovered for session:', sessionId);

      const { error } = await supabase
        .from('cart_abandonment_tracking')
        .update({
          recovered_at: new Date().toISOString(),
          is_abandoned: false
        })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Failed to mark cart as recovered:', error);
      }
    } catch (error) {
      console.error('Error marking cart as recovered:', error);
    }
  }, [sessionId, enabled]);

  // Get cart recovery stats (for admin)
  const getCartRecoveryStats = useCallback(async (days: number = 30) => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('cart_abandonment_tracking')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Failed to fetch cart recovery stats:', error);
        return null;
      }

      const stats = {
        total_carts: data.length,
        abandoned_carts: data.filter(cart => cart.is_abandoned).length,
        recovered_carts: data.filter(cart => cart.recovered_at).length,
        recovery_emails_sent: data.filter(cart => cart.recovery_email_sent_at).length,
        total_value: data.reduce((sum, cart) => sum + (cart.total_value || 0), 0),
        abandoned_value: data
          .filter(cart => cart.is_abandoned && !cart.recovered_at)
          .reduce((sum, cart) => sum + (cart.total_value || 0), 0),
        recovered_value: data
          .filter(cart => cart.recovered_at)
          .reduce((sum, cart) => sum + (cart.total_value || 0), 0)
      };

      return {
        ...stats,
        recovery_rate: stats.abandoned_carts > 0 
          ? (stats.recovered_carts / stats.abandoned_carts) * 100 
          : 0,
        average_cart_value: stats.total_carts > 0 
          ? stats.total_value / stats.total_carts 
          : 0
      };
    } catch (error) {
      console.error('Error fetching cart recovery stats:', error);
      return null;
    }
  }, []);

  // Set up session tracking on mount
  useEffect(() => {
    if (!enabled || !sessionId) return;

    console.log('Setting up cart abandonment tracking for session:', sessionId);

    // Optional: Set up periodic tracking for active sessions
    const interval = setInterval(() => {
      // Could track session activity here if needed
      console.log('Cart session still active:', sessionId);
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, enabled]);

  return {
    trackCartUpdate,
    markCartRecovered,
    getCartRecoveryStats
  };
};