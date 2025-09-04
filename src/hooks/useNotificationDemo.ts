import { useCallback } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { useNotificationSoundEffect } from '@/hooks/useNotificationSound';

/**
 * Demo hook showing how to use the notification system
 * This can be used in any component to trigger notifications
 */
export const useNotificationDemo = () => {
  const { addNotification } = useNotifications();
  const playNotificationSound = useNotificationSoundEffect();

  const showSuccessNotification = useCallback(() => {
    addNotification({
      type: 'success',
      title: 'Order Confirmed!',
      message: 'Your order #12345 has been confirmed and is being prepared.',
      sound: true,
      action: {
        label: 'View Order',
        onClick: () => console.log('Navigate to order details'),
      },
    });
    playNotificationSound('success');
  }, [addNotification, playNotificationSound]);

  const showOrderNotification = useCallback(() => {
    addNotification({
      type: 'order',
      title: 'Order Update',
      message: 'Your order is out for delivery! Expected delivery: 25 mins',
      sound: true,
      action: {
        label: 'Track Order',
        onClick: () => console.log('Navigate to tracking'),
      },
    });
    playNotificationSound('order');
  }, [addNotification, playNotificationSound]);

  const showErrorNotification = useCallback(() => {
    addNotification({
      type: 'error',
      title: 'Payment Failed',
      message: 'There was an issue processing your payment. Please try again.',
      sound: true,
      action: {
        label: 'Retry Payment',
        onClick: () => console.log('Navigate to payment'),
      },
      autoClose: false, // Keep error notifications until manually dismissed
    });
    playNotificationSound('error');
  }, [addNotification, playNotificationSound]);

  const showWarningNotification = useCallback(() => {
    addNotification({
      type: 'warning',
      title: 'Cart Expiring Soon',
      message: 'Items in your cart will expire in 10 minutes. Complete your order now!',
      sound: true,
      action: {
        label: 'Complete Order',
        onClick: () => console.log('Navigate to checkout'),
      },
    });
    playNotificationSound('warning');
  }, [addNotification, playNotificationSound]);

  const showInfoNotification = useCallback(() => {
    addNotification({
      type: 'info',
      title: 'New Menu Items!',
      message: 'Check out our latest additions to the menu. Limited time special offers available.',
      sound: true,
      action: {
        label: 'View Menu',
        onClick: () => console.log('Navigate to menu'),
      },
    });
    playNotificationSound('info');
  }, [addNotification, playNotificationSound]);

  // Real-world integration examples
  const showOrderStatusUpdate = useCallback((orderNumber: string, status: string) => {
    const statusMessages = {
      confirmed: 'Your order has been confirmed and is being prepared.',
      preparing: 'Your order is being prepared by our kitchen.',
      ready: 'Your order is ready for pickup/delivery!',
      dispatched: 'Your order is out for delivery.',
      delivered: 'Your order has been delivered successfully!',
    };

    addNotification({
      type: status === 'delivered' ? 'success' : 'order',
      title: `Order ${orderNumber} ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: statusMessages[status as keyof typeof statusMessages] || `Order status updated to ${status}`,
      sound: true,
      action: {
        label: 'View Details',
        onClick: () => console.log(`Navigate to order ${orderNumber}`),
      },
    });
    playNotificationSound(status === 'delivered' ? 'success' : 'order');
  }, [addNotification, playNotificationSound]);

  const showPromotionNotification = useCallback((promotion: { title: string; discount: string }) => {
    addNotification({
      type: 'info',
      title: promotion.title,
      message: `Get ${promotion.discount} off on your next order! Limited time offer.`,
      sound: true,
      action: {
        label: 'Shop Now',
        onClick: () => console.log('Navigate to products with promotion'),
      },
      duration: 8000, // Show promotion longer
    });
    playNotificationSound('info');
  }, [addNotification, playNotificationSound]);

  return {
    // Demo functions
    showSuccessNotification,
    showOrderNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
    
    // Real-world functions
    showOrderStatusUpdate,
    showPromotionNotification,
  };
};