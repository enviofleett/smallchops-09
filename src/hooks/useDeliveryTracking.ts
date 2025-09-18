import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryLocation {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface DeliveryTracking {
  orderId: string;
  orderNumber: string;
  status: string;
  estimatedDeliveryTime?: string;
  currentLocation?: DeliveryLocation;
  deliveryRoute?: DeliveryLocation[];
  riderInfo?: {
    name: string;
    phone: string;
    vehicleInfo: string;
  };
}

export const useDeliveryTracking = (orderIdOrNumber?: string) => {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackOrder = async (orderIdentifier: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 [TRACK] Starting order tracking for: ${orderIdentifier}`);
      
      // Step 1: Get basic order details first (production-safe query)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${orderIdentifier},order_number.eq.${orderIdentifier}`)
        .maybeSingle(); // Use maybeSingle() for production safety

      if (orderError) {
        console.error(`❌ [TRACK] Database error:`, orderError);
        throw orderError;
      }

      if (!order) {
        console.warn(`⚠️ [TRACK] Order not found: ${orderIdentifier}`);
        throw new Error('Order not found. Please check your order number and try again.');
      }

      console.log(`✅ [TRACK] Order found:`, order.order_number);

      // Step 2: Get rider information safely (separate query to avoid JOIN issues)
      let riderInfo = undefined;
      if (order.assigned_rider_id) {
        console.log(`👤 [TRACK] Fetching rider info for ID: ${order.assigned_rider_id}`);
        try {
          const { data: riderData, error: riderError } = await supabase
            .from('profiles')
            .select('name, phone')
            .eq('id', order.assigned_rider_id)
            .maybeSingle();

          if (!riderError && riderData) {
            riderInfo = {
              name: riderData.name || 'Delivery Rider',
              phone: riderData.phone || '',
              vehicleInfo: 'Delivery Vehicle'
            };
            console.log(`✅ [TRACK] Rider info loaded:`, riderInfo.name);
          }
        } catch (riderErr) {
          console.warn(`⚠️ [TRACK] Could not load rider info (non-blocking):`, riderErr);
          // Continue without rider info - this shouldn't break tracking
        }
      }

      // Step 3: Create tracking data
      const trackingData: DeliveryTracking = {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        estimatedDeliveryTime: order.delivery_time,
        riderInfo
      };

      console.log(`🎯 [TRACK] Tracking data prepared:`, {
        orderNumber: trackingData.orderNumber,
        status: trackingData.status,
        hasRider: !!trackingData.riderInfo
      });

      setTracking(trackingData);
    } catch (err) {
      console.error(`❌ [TRACK] Tracking failed:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to track order. Please try again or contact support.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = (orderIdOrNumber: string) => {
    // Only subscribe if we have a valid tracking object
    if (!tracking) {
      console.log(`⚠️ [TRACK] Skipping real-time subscription - no active tracking`);
      return () => {};
    }

    console.log(`📡 [TRACK] Setting up real-time updates for: ${orderIdOrNumber}`);
    
    const channel = supabase
      .channel(`order-tracking-${orderIdOrNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id.eq.${tracking.orderId}` // Use actual order ID, not search term
        },
        (payload) => {
          console.log(`📡 [TRACK] Real-time update received:`, payload.new);
          if (tracking && payload.new) {
            setTracking(prev => prev ? {
              ...prev,
              status: payload.new.status,
              estimatedDeliveryTime: payload.new.delivery_time
            } : null);
            toast.info(`Order status updated to: ${payload.new.status.replace('_', ' ')}`);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [TRACK] Subscription status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (orderIdOrNumber) {
      trackOrder(orderIdOrNumber);
      const unsubscribe = subscribeToUpdates(orderIdOrNumber);
      return unsubscribe;
    }
  }, [orderIdOrNumber]);

  return {
    tracking,
    loading,
    error,
    trackOrder,
    refetch: () => orderIdOrNumber ? trackOrder(orderIdOrNumber) : null
  };
};

export const useDeliveryZones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select(`
          *,
          delivery_fees(*)
        `);

      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      console.error('Error fetching delivery zones:', err);
      toast.error('Failed to load delivery zones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  return { zones, loading, refetch: fetchZones };
};