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
      // Use the secure RPC function to bypass RLS for guest tracking
      const { data: orderData, error: rpcError } = await (supabase as any)
        .rpc('get_order_for_tracking', { p_order_identifier: orderIdentifier });

      if (rpcError) throw rpcError;
      
      if (!orderData) {
        throw new Error('Order not found. Please check your order number and try again.');
      }

      // Transform the RPC result to match the expected format
      // Note: The RPC returns a JSON object with specific fields
      const trackingData: DeliveryTracking = {
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        status: orderData.status,
        estimatedDeliveryTime: orderData.delivery_time,
        riderInfo: orderData.profiles ? {
          name: orderData.profiles.name || 'Delivery Rider',
          phone: orderData.profiles.phone || '',
          vehicleInfo: orderData.vehicle_assignments?.[0]?.vehicles 
            ? `${orderData.vehicle_assignments[0].vehicles.color || ''} ${orderData.vehicle_assignments[0].vehicles.brand} ${orderData.vehicle_assignments[0].vehicles.model} (${orderData.vehicle_assignments[0].vehicles.license_plate})`
            : 'Delivery Vehicle'
        } : undefined
      };

      setTracking(trackingData);
    } catch (err) {
      console.error('Tracking error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to track order. Please check your order number and try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = (orderIdOrNumber: string) => {
    const channel = supabase
      .channel('order-tracking')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id.eq.${orderIdOrNumber}`
        },
        (payload) => {
          if (tracking) {
            setTracking(prev => prev ? {
              ...prev,
              status: payload.new.status,
              estimatedDeliveryTime: payload.new.delivery_time
            } : null);
          }
        }
      )
      .subscribe();

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