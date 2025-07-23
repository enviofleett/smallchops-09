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
      // Get order details with rider assignment
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:assigned_rider_id(name, phone),
          vehicle_assignments(
            vehicles(type, brand, model, license_plate)
          )
        `)
        .or(`id.eq.${orderIdentifier},order_number.eq.${orderIdentifier}`)
        .single();

      if (orderError) throw orderError;

      const trackingData: DeliveryTracking = {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        estimatedDeliveryTime: order.delivery_time,
        riderInfo: order.profiles ? {
          name: order.profiles.name || 'Delivery Rider',
          phone: order.profiles.phone || '',
          vehicleInfo: 'Delivery Vehicle'
        } : undefined
      };

      setTracking(trackingData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to track order';
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