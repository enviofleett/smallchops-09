import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatAddress, emergencySafeFormatAddress } from '@/utils/formatAddress';
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
      
      if (rpcError || (comprehensiveData && typeof comprehensiveData === 'object' && comprehensiveData && 'error' in comprehensiveData)) {
        console.warn('⚠️ Comprehensive RPC failed, using fallback:', rpcError || comprehensiveData);
        
        // Enhanced fallback with comprehensive data
        const [orderResult, scheduleResult, itemsResult, communicationResult, auditResult] = await Promise.all([
          supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
          supabase.from('order_delivery_schedule').select('*').eq('order_id', orderId).maybeSingle(),
          supabase.from('order_items').select(`
            *,
            product:products (
              id, name, description, price, cost_price, image_url, 
              category_id, features, ingredients
            )
          `).eq('order_id', orderId),
          supabase.from('communication_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
          supabase.from('audit_logs').select('*').eq('entity_id', orderId).order('created_at', { ascending: false }).limit(20)
        ]);
        
        if (orderResult.error) {
          console.error('Error fetching order:', orderResult.error);
          throw new Error(`Order not found or access denied: ${orderResult.error.message}`);
        }

        if (!orderResult.data) {
          throw new Error('Order not found');
        }
        
        // Build comprehensive response structure with all data
        const order = orderResult.data;
        const deliverySchedule = scheduleResult.data;
        const rawItems = itemsResult.data || [];
        const communications = communicationResult.data || [];
        const auditLogs = auditResult.data || [];
        
        // Normalize order items to ensure consistent .product field
        const normalizedItems = rawItems.map((item: any) => ({
          ...item,
          // Ensure .product is always present and consistent
          product: item.product || (Array.isArray(item.products) ? item.products[0] : item.products) || null
        }));
        
        return {
          order: order,
          items: normalizedItems,
          communication_events: communications,
          audit_logs: auditLogs,
          delivery_schedule: deliverySchedule,
          fulfillment_info: {
            type: order.order_type || 'delivery',
            address: emergencySafeFormatAddress(order.delivery_address),
            pickup_time: order.pickup_time,
            delivery_date: deliverySchedule?.delivery_date,
            delivery_hours: deliverySchedule ? {
              start: deliverySchedule.delivery_time_start,
              end: deliverySchedule.delivery_time_end,
              is_flexible: deliverySchedule.is_flexible
            } : null,
            order_instructions: order.special_instructions,
            special_instructions: deliverySchedule?.special_instructions || order.special_instructions
          },
          pickup_point: null, // Will be fetched separately if needed
          business_settings: null, // Will be fetched separately if needed
          timeline: [] // Will be built from audit logs
        };
      }
      
      console.log('✅ Order data loaded successfully');
      
      // Apply production safety sanitization before returning
      if (comprehensiveData && typeof comprehensiveData === 'object') {
        const data = comprehensiveData as any;
        if (data.order?.delivery_address) {
          data.order.delivery_address = emergencySafeFormatAddress(data.order.delivery_address);
        }
        
        // Normalize order items to ensure consistent .product field
        if (Array.isArray(data.items)) {
          data.items = data.items.map((item: any) => ({
            ...item,
            // Ensure .product is always present and consistent
            product: item.product || (Array.isArray(item.products) ? item.products[0] : item.products) || null
          }));
        }
      }
      
      return comprehensiveData;
    },
    enabled: !!orderId,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 2
  });

  // Setup real-time subscriptions with performance optimization
  const setupSubscriptions = useCallback(() => {
    if (!orderId) return;

    console.log('📡 Setting up optimized real-time subscriptions for order:', orderId);
    setConnectionStatus('connecting');

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create single channel for all subscriptions (more efficient)
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
          console.log('📦 Order updated:', payload);
          setLastUpdated(new Date());
          // Debounced refetch for better performance
          setTimeout(() => refetch(), 100);
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
          setTimeout(() => refetch(), 100);
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
          setTimeout(() => refetch(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_events',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('📧 Communication events updated:', payload);
          setLastUpdated(new Date());
          // Lower priority refresh for communication events
          setTimeout(() => refetch(), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_logs',
          filter: `entity_id=eq.${orderId}`
        },
        (payload) => {
          console.log('📋 Audit logs updated:', payload);
          setLastUpdated(new Date());
          // Lower priority refresh for audit logs
          setTimeout(() => refetch(), 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Optimized subscription status:', status);
        
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
          
          // Exponential backoff reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting optimized reconnection for order:', orderId);
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