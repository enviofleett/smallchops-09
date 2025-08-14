import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OrderWithDeliverySchedule } from '@/api/deliveryScheduleApi';
import { toast } from 'sonner';

export const useDeliveryRealtime = (
  orders: OrderWithDeliverySchedule[],
  onOrderUpdate: (updatedOrder: OrderWithDeliverySchedule) => void
) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Subscribe to order updates
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'order_type=eq.delivery'
        },
        (payload) => {
          console.log('Order updated:', payload);
          const updatedOrder = payload.new as any;
          
          // Find the matching order and update it
          const existingOrder = orders.find(o => o.id === updatedOrder.id);
          if (existingOrder) {
            onOrderUpdate({
              ...existingOrder,
              ...updatedOrder,
              delivery_schedule: existingOrder.delivery_schedule
            });
            
            // Show notification for status changes
            if (payload.old?.status !== updatedOrder.status) {
              toast.success(
                `Order #${updatedOrder.order_number} status updated to ${updatedOrder.status.replace('_', ' ')}`,
                {
                  description: `Customer: ${updatedOrder.customer_name}`,
                  duration: 4000
                }
              );
            }
          }
          
          setLastUpdate(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_delivery_schedule'
        },
        (payload) => {
          console.log('Delivery schedule updated:', payload);
          setLastUpdate(new Date());
          
          // Trigger a refetch for schedule changes
          toast.info('Delivery schedule updated', {
            description: 'Refreshing delivery information...',
            duration: 3000
          });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });

    // Subscribe to delivery status updates from drivers
    const deliveryUpdatesChannel = supabase
      .channel('delivery-updates')
      .on('broadcast', { event: 'location_update' }, (payload) => {
        console.log('Driver location update:', payload);
        // Handle driver location updates for live tracking
      })
      .on('broadcast', { event: 'delivery_status' }, (payload) => {
        console.log('Delivery status broadcast:', payload);
        toast.success(`Delivery Update: ${payload.message}`, {
          description: payload.orderNumber ? `Order #${payload.orderNumber}` : undefined,
          duration: 4000
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(deliveryUpdatesChannel);
    };
  }, [orders, onOrderUpdate]);

  // Broadcast delivery status updates
  const broadcastDeliveryUpdate = async (orderId: string, status: string, message: string) => {
    const channel = supabase.channel('delivery-updates');
    await channel.send({
      type: 'broadcast',
      event: 'delivery_status',
      payload: {
        orderId,
        status,
        message,
        timestamp: new Date().toISOString()
      }
    });
  };

  return {
    connectionStatus,
    lastUpdate,
    broadcastDeliveryUpdate
  };
};