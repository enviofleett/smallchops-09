import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface UseRealTimeOrderUpdatesOptions {
  onOrderUpdate?: (payload: any) => void;
  onDeliveryScheduleUpdate?: (payload: any) => void;
  onPickupPointUpdate?: (payload: any) => void;
  onOrderItemUpdate?: (payload: any) => void;
  enableNotifications?: boolean;
}

/**
 * Comprehensive real-time subscription hook for order-related changes
 * Subscribes to orders, delivery schedules, pickup points, and order items
 */
export const useRealTimeOrderUpdates = (options: UseRealTimeOrderUpdatesOptions = {}) => {
  const {
    onOrderUpdate,
    onDeliveryScheduleUpdate, 
    onPickupPointUpdate,
    onOrderItemUpdate,
    enableNotifications = false
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setupSubscriptions = () => {
    console.log('🔄 Setting up real-time subscriptions...');
    setConnectionStatus('connecting');

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create comprehensive channel for all order-related updates
    const channel = supabase
      .channel('order-updates-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('📦 Order updated:', payload);
          setLastUpdate(new Date());
          
          if (enableNotifications) {
            const action = payload.eventType === 'INSERT' ? 'created' : 
                          payload.eventType === 'UPDATE' ? 'updated' : 'deleted';
            const orderNumber = (payload.new as any)?.order_number || (payload.old as any)?.order_number || 'Unknown';
            toast.success(`Order ${action}: #${orderNumber}`);
          }
          
          onOrderUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_delivery_schedule'
        },
        (payload) => {
          console.log('🚚 Delivery schedule updated:', payload);
          setLastUpdate(new Date());
          
          if (enableNotifications) {
            const action = payload.eventType === 'INSERT' ? 'created' : 
                          payload.eventType === 'UPDATE' ? 'updated' : 'deleted';
            toast.info(`Delivery schedule ${action}`);
          }
          
          onDeliveryScheduleUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pickup_points'
        },
        (payload) => {
          console.log('📍 Pickup point updated:', payload);
          setLastUpdate(new Date());
          
          if (enableNotifications) {
            const action = payload.eventType === 'INSERT' ? 'created' : 
                          payload.eventType === 'UPDATE' ? 'updated' : 'deleted';
            const pointName = (payload.new as any)?.name || (payload.old as any)?.name || 'Unknown';
            toast.info(`Pickup point ${action}: ${pointName}`);
          }
          
          onPickupPointUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        (payload) => {
          console.log('🛍️ Order items updated:', payload);
          setLastUpdate(new Date());
          
          if (enableNotifications) {
            const action = payload.eventType === 'INSERT' ? 'added' : 
                          payload.eventType === 'UPDATE' ? 'updated' : 'removed';
            toast.info(`Order item ${action}`);
          }
          
          onOrderItemUpdate?.(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscriptions active');
          setConnectionStatus('connected');
          
          // Clear any pending reconnect attempts
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
          setConnectionStatus('disconnected');
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            setupSubscriptions();
          }, 5000);
        } else if (status === 'CLOSED') {
          console.log('🔌 Real-time connection closed');
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;
  };

  // Initialize subscriptions on mount
  useEffect(() => {
    setupSubscriptions();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up real-time subscriptions');
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  // Manual reconnect function
  const reconnect = () => {
    console.log('🔄 Manual reconnect triggered');
    setupSubscriptions();
  };

  return {
    connectionStatus,
    lastUpdate,
    reconnect,
    isConnected: connectionStatus === 'connected'
  };
};