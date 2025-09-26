import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealTimeOrderDataHook {
  data: any;
  isLoading: boolean;
  error: any;
  lastUpdated: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  reconnect: () => void;
}

/**
 * Hook for real-time order data with live updates
 * Optimized for OrderDetailsModal with comprehensive RPC and subscriptions
 */
export const useRealTimeOrderData = (orderId: string | undefined): RealTimeOrderDataHook => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Primary query using comprehensive RPC
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['real-time-order-data', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      
      console.log('🔍 Fetching order data for:', orderId);
      
      // Use comprehensive RPC as primary source
      const { data: comprehensiveData, error: rpcError } = await supabase
        .rpc('get_comprehensive_order_fulfillment', { p_order_id: orderId });
      
      if (rpcError) {
        console.warn('⚠️ Comprehensive RPC failed, using fallback:', rpcError);
        
        // Fallback to individual queries
        const [orderResult, scheduleResult] = await Promise.all([
          supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
          supabase.from('order_delivery_schedule').select('*').eq('order_id', orderId).maybeSingle()
        ]);
        
        if (orderResult.error) throw orderResult.error;
        
        return {
          order: orderResult.data,
          delivery_schedule: scheduleResult.data,
          items: [],
          fulfillment_info: {
            type: orderResult.data?.order_type || 'delivery',
            address: (orderResult.data?.delivery_address as any)?.address_line_1 || 
                    (orderResult.data?.delivery_address as any)?.address || 
                    'Address not available'
          }
        };
      }
      
      console.log('✅ Order data loaded successfully');
      return comprehensiveData;
    },
    enabled: !!orderId,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 2
  });

  // Setup real-time subscriptions
  const setupSubscriptions = useCallback(() => {
    if (!orderId) return;

    console.log('📡 Setting up real-time subscriptions for order:', orderId);
    setConnectionStatus('connecting');

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel for real-time updates
    const channel = supabase
      .channel(`order-details-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('📦 Order updated:', payload);
          setLastUpdated(new Date());
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_delivery_schedule',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('🚚 Delivery schedule updated:', payload);
          setLastUpdated(new Date());
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('🛍️ Order items updated:', payload);
          setLastUpdated(new Date());
          refetch();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscriptions active for order:', orderId);
          setConnectionStatus('connected');
          
          // Clear any pending reconnect attempts
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error for order:', orderId);
          setConnectionStatus('disconnected');
          
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect for order:', orderId);
            setupSubscriptions();
          }, 3000);
        } else if (status === 'CLOSED') {
          console.log('🔌 Real-time connection closed for order:', orderId);
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;
  }, [orderId, refetch]);

  // Set up subscriptions when orderId changes
  useEffect(() => {
    if (orderId) {
      setupSubscriptions();
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up real-time subscriptions for order:', orderId);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      setConnectionStatus('disconnected');
    };
  }, [orderId, setupSubscriptions]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnect triggered for order:', orderId);
    setupSubscriptions();
  }, [setupSubscriptions]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    connectionStatus,
    reconnect
  };
};