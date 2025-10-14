import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/context/NotificationContext";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";

export const OrderNotificationListener = () => {
  const { addFloatingNotification } = useNotifications();
  const { isAdmin, isLoading: authLoading } = useUnifiedAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const processingRef = useRef<Set<string>>(new Set());
  const lastEventTimeRef = useRef<number>(0);

  useEffect(() => {
    // ✅ Only admins should receive real-time order notifications
    if (authLoading || !isAdmin) {
      return;
    }
    let retryCount = 0;
    const maxRetries = 3;

    const setupSubscription = () => {
      // Cleanup existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      console.log('[OrderNotificationListener] Setting up real-time subscription...');

      const channel = supabase
        .channel('floating-order-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            const now = Date.now();
            
            // Debounce: Ignore events within 500ms of last event
            if (now - lastEventTimeRef.current < 500) {
              return;
            }
            lastEventTimeRef.current = now;

            const order = payload.new as any;

            // Validate order data
            if (!order?.id || !order?.order_number) {
              console.warn('[OrderNotificationListener] Invalid order data:', order);
              return;
            }

            // Prevent duplicate processing
            if (processingRef.current.has(order.id)) {
              return;
            }

            processingRef.current.add(order.id);

            // Clear from processing after 5 seconds
            setTimeout(() => {
              processingRef.current.delete(order.id);
            }, 5000);

            // Filter for new orders only
            const validStatuses = ['pending', 'confirmed'];
            if (!validStatuses.includes(order.status)) {
              return;
            }

            console.log('[OrderNotificationListener] New order received:', {
              id: order.id,
              orderNumber: order.order_number,
              status: order.status,
              totalAmount: order.total_amount,
            });

            // Format customer name
            const customerName = order.customer_name || 'Guest Customer';

            // Create rich notification
            addFloatingNotification({
              id: `order-${order.id}-${Date.now()}`,
              type: 'order',
              title: `New Order: ${order.order_number}`,
              message: `${customerName} placed an order for ₦${Number(order.total_amount || 0).toLocaleString()}`,
              timestamp: new Date(),
              read: false,
              data: {
                orderId: order.id,
                orderNumber: order.order_number,
                customerName: customerName,
                totalAmount: order.total_amount,
                itemCount: 0, // Will be populated from order_items if needed
                status: order.status,
              },
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[OrderNotificationListener] ✅ Successfully subscribed to order updates');
            retryCount = 0; // Reset retry count on success
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[OrderNotificationListener] ❌ Channel error, attempting retry...');
            
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(() => {
                setupSubscription();
              }, 2000 * retryCount); // Exponential backoff
            } else {
              toast({
                title: "Connection Issue",
                description: "Unable to connect to real-time order updates. Please refresh the page.",
                variant: "destructive",
              });
            }
          } else if (status === 'TIMED_OUT') {
            console.warn('[OrderNotificationListener] ⚠️ Connection timed out, retrying...');
            setupSubscription();
          }
        });

      channelRef.current = channel;
    };

    // Initial setup
    setupSubscription();

    // Cleanup on unmount
    return () => {
      console.log('[OrderNotificationListener] Cleaning up subscription...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      processingRef.current.clear();
    };
  }, [addFloatingNotification, isAdmin, authLoading]);

  return null; // This is a logic-only component
};
