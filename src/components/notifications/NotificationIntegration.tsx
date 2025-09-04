import { useEffect } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { useNotificationSoundEffect } from '@/hooks/useNotificationSound';

/**
 * Integration component that connects notifications to real-world events
 * This component should be placed in the main layout to listen for global events
 */
export const NotificationIntegration = () => {
  const { addNotification } = useNotifications();
  const playNotificationSound = useNotificationSoundEffect();

  useEffect(() => {
    // Listen for custom events that trigger notifications
    const handleOrderUpdate = (event: CustomEvent) => {
      const { orderNumber, status, message } = event.detail;
      
      addNotification({
        type: 'order',
        title: `Order ${orderNumber} ${status}`,
        message: message || `Your order status has been updated to ${status}`,
        sound: true,
        action: {
          label: 'View Order',
          onClick: () => {
            window.location.href = `/track/${orderNumber}`;
          },
        },
      });
      
      playNotificationSound('order');
    };

    const handlePaymentSuccess = (event: CustomEvent) => {
      const { orderNumber, amount } = event.detail;
      
      addNotification({
        type: 'success',
        title: 'Payment Successful!',
        message: `Payment of ₦${amount?.toLocaleString()} for order ${orderNumber} was successful.`,
        sound: true,
        action: {
          label: 'View Order',
          onClick: () => {
            window.location.href = `/track/${orderNumber}`;
          },
        },
      });
      
      playNotificationSound('success');
    };

    const handlePaymentError = (event: CustomEvent) => {
      const { error, orderNumber } = event.detail;
      
      addNotification({
        type: 'error',
        title: 'Payment Failed',
        message: error || 'There was an issue processing your payment.',
        sound: true,
        action: {
          label: 'Retry Payment',
          onClick: () => {
            if (orderNumber) {
              window.location.href = `/orders/${orderNumber}`;
            }
          },
        },
        autoClose: false, // Keep error notifications visible
      });
      
      playNotificationSound('error');
    };

    const handlePromotion = (event: CustomEvent) => {
      const { title, message, action } = event.detail;
      
      addNotification({
        type: 'info',
        title: title || '🎉 Special Offer!',
        message: message || 'New promotion available just for you!',
        sound: true,
        action: action || {
          label: 'Shop Now',
          onClick: () => {
            window.location.href = '/products';
          },
        },
        duration: 8000,
      });
      
      playNotificationSound('info');
    };

    const handleCartReminder = (event: CustomEvent) => {
      const { itemCount } = event.detail;
      
      addNotification({
        type: 'warning',
        title: 'Cart Reminder',
        message: `You have ${itemCount} item${itemCount !== 1 ? 's' : ''} in your cart. Complete your order before they expire!`,
        sound: true,
        action: {
          label: 'View Cart',
          onClick: () => {
            window.location.href = '/cart';
          },
        },
      });
      
      playNotificationSound('warning');
    };

    // Add event listeners
    window.addEventListener('order:updated', handleOrderUpdate as EventListener);
    window.addEventListener('payment:success', handlePaymentSuccess as EventListener);
    window.addEventListener('payment:error', handlePaymentError as EventListener);
    window.addEventListener('promotion:available', handlePromotion as EventListener);
    window.addEventListener('cart:reminder', handleCartReminder as EventListener);

    return () => {
      // Cleanup event listeners
      window.removeEventListener('order:updated', handleOrderUpdate as EventListener);
      window.removeEventListener('payment:success', handlePaymentSuccess as EventListener);
      window.removeEventListener('payment:error', handlePaymentError as EventListener);
      window.removeEventListener('promotion:available', handlePromotion as EventListener);
      window.removeEventListener('cart:reminder', handleCartReminder as EventListener);
    };
  }, [addNotification, playNotificationSound]);

  return null; // This component doesn't render anything
};

// Helper functions to trigger notifications from anywhere in the app
export const triggerOrderUpdate = (orderNumber: string, status: string, message?: string) => {
  window.dispatchEvent(new CustomEvent('order:updated', {
    detail: { orderNumber, status, message }
  }));
};

export const triggerPaymentSuccess = (orderNumber: string, amount: number) => {
  window.dispatchEvent(new CustomEvent('payment:success', {
    detail: { orderNumber, amount }
  }));
};

export const triggerPaymentError = (error: string, orderNumber?: string) => {
  window.dispatchEvent(new CustomEvent('payment:error', {
    detail: { error, orderNumber }
  }));
};

export const triggerPromotion = (title: string, message: string, action?: { label: string; onClick: () => void }) => {
  window.dispatchEvent(new CustomEvent('promotion:available', {
    detail: { title, message, action }
  }));
};

export const triggerCartReminder = (itemCount: number) => {
  window.dispatchEvent(new CustomEvent('cart:reminder', {
    detail: { itemCount }
  }));
};