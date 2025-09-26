import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealTimeOrderDataHook {
  data: any;
  isLoading: boolean;
  error: any;
  lastUpdated: Date | null;
}

/**
 * Hook for real-time order data with live updates
 * Optimized for OrderDetailsModal with comprehensive RPC and subscriptions
 */
export const useRealTimeOrderData = (orderId: string | undefined): RealTimeOrderDataHook => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Primary query using comprehensive RPC
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['real-time-order-data', orderId],
    queryFn: async () => {
      if (!orderId) throw new Error('Order ID is required');
      
      // Use comprehensive RPC as primary source
      const { data: comprehensiveData, error: rpcError } = await supabase
        .rpc('get_comprehensive_order_fulfillment', { p_order_id: orderId });
      
      if (rpcError) {
        console.warn('Comprehensive RPC failed, using fallback:', rpcError);
        
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
      
      return comprehensiveData;
    },
    enabled: !!orderId,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 2
  });

  // Set up real-time subscriptions
  useEffect(() => {
    if (!orderId) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel for real-time updates
    const channel = supabase
      .channel(`order-updates-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('Order updated:', payload);
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
          console.log('Delivery schedule updated:', payload);
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
          console.log('Order items updated:', payload);
          setLastUpdated(new Date());
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscriptions active for order:', orderId);
        }
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orderId, refetch]);

  return {
    data,
    isLoading,
    error,
    lastUpdated
  };
};