import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderNotification {
  id: string;
  orderId: string;
  orderNumber: string;
  type: 'new_order' | 'status_change';
  message: string;
  timestamp: string;
  read: boolean;
  customerName?: string;
  newStatus?: string;
  oldStatus?: string;
}

export function useOrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to new orders
    const newOrdersChannel = supabase
      .channel('new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('New order received:', payload);
          const order = payload.new;
          
          const notification: OrderNotification = {
            id: `new_order_${order.id}`,
            orderId: order.id,
            orderNumber: order.order_number,
            type: 'new_order',
            message: `New order ${order.order_number} from ${order.customer_name}`,
            timestamp: new Date().toISOString(),
            read: false,
            customerName: order.customer_name,
          };

          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification('New Order Received!', {
              body: notification.message,
              icon: '/favicon.ico'
            });
          }
        }
      )
      .subscribe();

    // Subscribe to order status changes
    const statusChangesChannel = supabase
      .channel('order-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order status changed:', payload);
          const oldOrder = payload.old;
          const newOrder = payload.new;
          
          // Only notify if status actually changed
          if (oldOrder.status !== newOrder.status) {
            const notification: OrderNotification = {
              id: `status_change_${newOrder.id}_${Date.now()}`,
              orderId: newOrder.id,
              orderNumber: newOrder.order_number,
              type: 'status_change',
              message: `Order ${newOrder.order_number} status changed to ${newOrder.status}`,
              timestamp: new Date().toISOString(),
              read: false,
              customerName: newOrder.customer_name,
              newStatus: newOrder.status,
              oldStatus: oldOrder.status,
            };

            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Show browser notification for important status changes
            if (Notification.permission === 'granted' && 
                ['confirmed', 'cancelled', 'delivered', 'failed'].includes(newOrder.status)) {
              new Notification('Order Status Updated', {
                body: notification.message,
                icon: '/favicon.ico'
              });
            }
          }
        }
      )
      .subscribe();

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(newOrdersChannel);
      supabase.removeChannel(statusChangesChannel);
    };
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return {
    notifications: notifications.slice(0, 50), // Limit to 50 notifications
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
  };
}