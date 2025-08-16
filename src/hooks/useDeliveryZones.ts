
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryZone {
  id: string;
  name: string;
  is_active: boolean;
  polygon?: any;
  created_at: string;
  updated_at: string;
}

export interface DeliveryFee {
  id: string;
  zone_id: string;
  base_fee: number;
  fee_per_km: number;
  min_order_for_free_delivery?: number;
  created_at: string;
  updated_at: string;
}

export const useDeliveryZones = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [fees, setFees] = useState<DeliveryFee[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const { data: zonesData, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (zonesError) throw zonesError;

      const { data: feesData, error: feesError } = await supabase
        .from('delivery_fees')
        .select('*');

      if (feesError) throw feesError;

      setZones(zonesData || []);
      setFees(feesData || []);
    } catch (err) {
      console.error('Error fetching delivery zones:', err);
      toast.error('Failed to load delivery zones');
    } finally {
      setLoading(false);
    }
  };

  const getZoneWithFees = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    const zoneFees = fees.filter(f => f.zone_id === zoneId);
    return { zone, fees: zoneFees };
  };

  const calculateDeliveryFee = (zoneId: string, orderAmount: number, distance?: number): number => {
    const zoneFees = fees.find(f => f.zone_id === zoneId);
    if (!zoneFees) return 0;

    // Check if order qualifies for free delivery
    if (zoneFees.min_order_for_free_delivery && orderAmount >= zoneFees.min_order_for_free_delivery) {
      return 0;
    }

    // Calculate fee: base fee + (distance * fee per km)
    let totalFee = zoneFees.base_fee;
    if (distance && zoneFees.fee_per_km) {
      totalFee += distance * zoneFees.fee_per_km;
    }

    return totalFee;
  };

  useEffect(() => {
    fetchZones();
  }, []);

  return { 
    zones, 
    fees, 
    loading, 
    refetch: fetchZones, 
    getZoneWithFees,
    calculateDeliveryFee 
  };
};
