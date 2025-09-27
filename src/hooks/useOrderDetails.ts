import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderModalState } from '@/types/orderDetailsModal';
import { toast } from 'sonner';

interface UseOrderDetailsReturn extends OrderModalState {
  refetch: () => Promise<void>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  lastUpdated: Date | null;
}

export const useOrderDetails = (orderId: string): UseOrderDetailsReturn => {
  const [state, setState] = useState<OrderModalState>({
    isLoading: true,
    error: null,
    order: null,
    isUpdatingStatus: false,
    isPrinting: false,
  });

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First try the comprehensive RPC function
      const { data: comprehensiveData, error: rpcError } = await supabase
        .rpc('get_comprehensive_order_fulfillment', { p_order_id: orderId });

      if (!rpcError && comprehensiveData && typeof comprehensiveData === 'object' && !(comprehensiveData as any).error) {
        const orderData = (comprehensiveData as any).order;
        const items = (comprehensiveData as any).items || [];
        const fulfillmentInfo = (comprehensiveData as any).fulfillment_info || {};
        const timeline = (comprehensiveData as any).timeline || [];

        const order: Order = {
          id: orderData.id,
          order_number: orderData.order_number,
          status: orderData.status,
          order_type: orderData.order_type,
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          customer_phone: orderData.customer_phone,
          payment_status: orderData.payment_status,
          total_amount: orderData.total_amount,
          created_at: orderData.created_at,
          updated_at: orderData.updated_at,
          items: items.map((item: any) => ({
            id: item.id,
            name: item.product?.name || 'Unknown Item',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            product_id: item.product_id,
            special_instructions: item.special_instructions,
            customizations: item.customizations,
          })),
          delivery_address: orderData.delivery_address,
          pickup_time: orderData.pickup_time,
          pickup_point_id: orderData.pickup_point_id,
          special_instructions: orderData.special_instructions || fulfillmentInfo.special_instructions,
          timeline: timeline.map((step: any) => ({
            step: step.event,
            label: step.event,
            completed: step.status === 'completed',
            datetime: step.timestamp,
            status: step.status === 'completed' ? 'completed' as const : (step.status === 'current' ? 'current' as const : 'pending' as const),
          })),
          subtotal: orderData.subtotal,
          tax_amount: orderData.tax_amount,
          delivery_fee: orderData.delivery_fee,
          discount_amount: orderData.discount_amount,
          vat_rate: orderData.vat_rate,
          vat_amount: orderData.vat_amount,
          paid_at: orderData.paid_at,
          processing_started_at: orderData.processing_started_at,
        };

        setState(prev => ({
          ...prev,
          order,
          isLoading: false,
          error: null,
        }));
        setLastUpdated(new Date());
        return;
      }

      // Fallback to basic order fetch
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              id,
              name,
              price,
              description
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw orderError;
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      // Transform basic data to our Order interface
      const order: Order = {
        id: orderData.id,
        order_number: orderData.order_number,
        status: orderData.status,
        order_type: orderData.order_type as 'delivery' | 'pickup',
        customer_name: orderData.customer_name,
        customer_email: orderData.customer_email,
        customer_phone: orderData.customer_phone,
        payment_status: (() => {
          const status = orderData.payment_status;
          if (status === 'completed') return 'paid';
          if (status === 'partially_refunded') return 'refunded';
          return status as 'pending' | 'paid' | 'refunded' | 'failed';
        })(),
        total_amount: orderData.total_amount,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at,
        items: (orderData.order_items || []).map((item: any) => ({
          id: item.id,
          name: item.products?.name || 'Unknown Item',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          product_id: item.product_id,
          special_instructions: item.special_instructions,
        })),
        delivery_address: orderData.delivery_address,
        pickup_time: orderData.pickup_time,
        pickup_point_id: orderData.pickup_point_id,
        special_instructions: orderData.special_instructions,
        timeline: [], // Will be generated based on status
      };

      // Generate basic timeline from status
      const statusTimeline = generateTimelineFromStatus(order.status, order.created_at, order.updated_at);
      order.timeline = statusTimeline;

      setState(prev => ({
        ...prev,
        order,
        isLoading: false,
        error: null,
      }));
      setLastUpdated(new Date());

    } catch (error: any) {
      console.error('Error fetching order details:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to fetch order details',
      }));
      toast.error('Failed to fetch order details');
    }
  }, [orderId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!orderId) return;

    fetchOrderDetails();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          console.log('Order updated:', payload);
          fetchOrderDetails();
          setLastUpdated(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          console.log('Order items updated:', payload);
          fetchOrderDetails();
          setLastUpdated(new Date());
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        } else {
          setConnectionStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchOrderDetails]);

  return {
    ...state,
    refetch: fetchOrderDetails,
    connectionStatus,
    lastUpdated,
  };
};

// Helper function to generate timeline from status
const generateTimelineFromStatus = (status: string, createdAt: string, updatedAt?: string) => {
  const steps = [
    { key: 'pending', label: 'Order Created' },
    { key: 'confirmed', label: 'Order Confirmed' },
    { key: 'preparing', label: 'Preparation Started' },
    { key: 'ready', label: 'Ready for Delivery/Pickup' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered/Picked Up' },
  ];

  const statusOrder = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
  const currentIndex = statusOrder.indexOf(status);

  return steps.map((step, index) => ({
    step: step.key,
    label: step.label,
    completed: index <= currentIndex,
    datetime: index === 0 ? createdAt : (index === currentIndex ? updatedAt : undefined),
    status: (index < currentIndex ? 'completed' : (index === currentIndex ? 'current' : 'pending')) as 'completed' | 'current' | 'pending',
  }));
};