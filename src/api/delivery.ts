import { supabase } from '@/integrations/supabase/client';
import {
  DeliveryZone,
  NewDeliveryZone,
  DeliveryFee,
  NewDeliveryFee,
  UpdatedDeliveryFee
} from '@/types/database';

export type DeliveryZoneWithFee = {
  id: string;
  name: string;
  base_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  delivery_fees?: DeliveryFee | null;
};

export const getDeliveryZonesWithFees = async (): Promise<DeliveryZoneWithFee[]> => {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return (data?.map(zone => ({
      id: zone.id,
      name: zone.name,
      base_fee: zone.base_fee,
      is_active: zone.is_active,
      created_at: zone.created_at,
      updated_at: zone.updated_at,
      delivery_fees: null // Legacy compatibility
  })) as DeliveryZoneWithFee[]);
};

export const upsertDeliveryZoneWithFee = async ({
    zone,
    fee,
} : {
    zone: { name: string; base_fee: number; is_active?: boolean; id?: string },
    fee: { base_fee: number; id?: string }
}) => {
    const zoneData = {
        name: zone.name,
        base_fee: fee.base_fee,
        is_active: zone.is_active ?? true,
        ...(zone.id && { id: zone.id })
    };

    const { data: savedZone, error: zoneError } = await supabase
        .from('delivery_zones')
        .upsert(zoneData)
        .select()
        .single();
    
    if (zoneError) throw zoneError;

    return {
        id: savedZone.id,
        name: savedZone.name,
        base_fee: savedZone.base_fee,
        is_active: savedZone.is_active,
        created_at: savedZone.created_at,
        updated_at: savedZone.updated_at,
        delivery_fees: null
    };
};

export const deleteDeliveryZone = async (zoneId: string) => {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', zoneId);
    if (error) throw error;
};
