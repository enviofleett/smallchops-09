/**
 * Production-ready utility for handling guest checkout order tracking
 * Manages auto-population of order numbers after successful guest payments
 */

interface OrderTrackingData {
  orderNumber?: string;
  order_number?: string;
  orderId?: string;
  order_id?: string;
  paidAt?: string;
  timestamp?: string;
}

export interface GuestOrderResult {
  orderIdentifier: string | null;
  source: 'session' | 'localStorage' | null;
  shouldCleanup: boolean;
}

/**
 * Retrieves the most recent guest checkout order number for auto-tracking
 * @param maxAgeMinutes - Maximum age of order to consider (default: 5 minutes)
 * @returns Order identifier and metadata, or null if none found
 */
export const getRecentGuestOrder = (maxAgeMinutes: number = 5): GuestOrderResult => {
  try {
    // Check sessionStorage first (most recent, highest priority)
    const recentPaymentSuccess = sessionStorage.getItem('paymentSuccess');
    if (recentPaymentSuccess) {
      const paymentData: OrderTrackingData = JSON.parse(recentPaymentSuccess);
      // PRODUCTION FIX: Prioritize formatted order_number, check fallback fields
      const orderIdentifier = paymentData.order_number || 
                             paymentData.orderNumber || 
                             paymentData.orderId ||      
                             paymentData.order_id;
      
      // Validate it's not a UUID (production safety check)
      if (orderIdentifier && !orderIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log('✅ Using formatted order number from session:', orderIdentifier);
        return {
          orderIdentifier,
          source: 'session',
          shouldCleanup: true
        };
      } else if (orderIdentifier) {
        console.warn('⚠️ Found UUID instead of formatted order number:', orderIdentifier);
        console.warn('⚠️ Cleaning up bad data - user will need manual entry');
        // Clean up the bad data immediately
        sessionStorage.removeItem('paymentSuccess');
      }
    }

    // Fallback to localStorage (persistent recent success)
    const lastPaymentSuccess = localStorage.getItem('lastPaymentSuccess');
    if (lastPaymentSuccess) {
      const paymentData: OrderTrackingData = JSON.parse(lastPaymentSuccess);
      // PRODUCTION FIX: Prioritize formatted order_number, check fallback fields
      const orderIdentifier = paymentData.order_number || 
                             paymentData.orderNumber || 
                             paymentData.orderId ||      
                             paymentData.order_id;
      
      // Only return if payment was within the specified time window and not a UUID
      const paymentTime = paymentData.paidAt || paymentData.timestamp;
      if (orderIdentifier && paymentTime && !orderIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const timeDiff = Date.now() - new Date(paymentTime).getTime();
        const maxAge = maxAgeMinutes * 60 * 1000;
        
        if (timeDiff < maxAge) {
          console.log('✅ Using formatted order number from localStorage:', orderIdentifier);
          return {
            orderIdentifier,
            source: 'localStorage',
            shouldCleanup: true
          };
        }
      } else if (orderIdentifier) {
        console.warn('⚠️ Found UUID instead of formatted order number:', orderIdentifier);
        console.warn('⚠️ Cleaning up bad data - user will need manual entry');
        // Clean up the bad data immediately
        localStorage.removeItem('lastPaymentSuccess');
      }
    }

    return {
      orderIdentifier: null,
      source: null,
      shouldCleanup: false
    };
  } catch (error) {
    console.warn('⚠️ Failed to retrieve recent guest order:', error);
    return {
      orderIdentifier: null,
      source: null,
      shouldCleanup: false
    };
  }
};

/**
 * Cleans up guest checkout tracking data after successful auto-population
 * @param source - The source where the data was found
 */
export const cleanupGuestOrderTracking = (source: 'session' | 'localStorage' | 'both' = 'both'): void => {
  try {
    if (source === 'session' || source === 'both') {
      sessionStorage.removeItem('paymentSuccess');
    }
    
    if (source === 'localStorage' || source === 'both') {
      localStorage.removeItem('lastPaymentSuccess');
    }
  } catch (error) {
    console.warn('⚠️ Failed to cleanup guest order tracking:', error);
  }
};

/**
 * Stores order tracking data for guest checkout (called after successful payment)
 * @param orderData - Order information to store
 */
export const storeGuestOrderTracking = (orderData: OrderTrackingData): void => {
  try {
    const trackingData = {
      ...orderData,
      timestamp: new Date().toISOString()
    };
    
    sessionStorage.setItem('paymentSuccess', JSON.stringify(trackingData));
    localStorage.setItem('lastPaymentSuccess', JSON.stringify(trackingData));
    
    console.log('✅ Guest order tracking stored:', { 
      orderNumber: orderData.orderNumber || orderData.order_number,
      timestamp: trackingData.timestamp 
    });
  } catch (error) {
    console.warn('⚠️ Failed to store guest order tracking:', error);
  }
};

/**
 * Production monitoring: Log guest checkout tracking events
 */
export const logGuestTrackingEvent = (event: 'auto_populated' | 'cleanup' | 'storage_check', details: Record<string, any>): void => {
  try {
    console.log(`📊 Guest Tracking [${event}]:`, {
      ...details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 50) // Truncated for privacy
    });
  } catch (error) {
    // Silent fail for logging
  }
};