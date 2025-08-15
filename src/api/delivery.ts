import { supabase } from '@/integrations/supabase/client';
import {
  DeliveryZone,
  NewDeliveryZone,
  DeliveryFee,
  NewDeliveryFee,
  UpdatedDeliveryFee
} from '@/types/database';

export type DeliveryZoneWithFee = DeliveryZone & {
  delivery_fees: DeliveryFee | null;
};

export const getDeliveryZonesWithFees = async (): Promise<DeliveryZoneWithFee[]> => {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select(`
      *,
      delivery_fees(*)
    `)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  
  // The join returns delivery_fees as an array. We expect one fee record per zone.
  return data.map(zone => ({
      ...zone,
      delivery_fees: Array.isArray(zone.delivery_fees) && zone.delivery_fees.length > 0 ? zone.delivery_fees[0] : null,
  })) as DeliveryZoneWithFee[];
};

export const upsertDeliveryZoneWithFee = async ({
    zone,
    fee,
} : {
    zone: NewDeliveryZone,
    fee: Omit<NewDeliveryFee, 'id' | 'zone_id'> & { id?: string }
}) => {

    const { data: zoneData, error: zoneError } = await supabase
        .from('delivery_zones')
        .upsert(zone)
        .select()
        .single();
    
    if (zoneError) throw zoneError;

    const feeDataToUpsert = {
        ...fee,
        zone_id: zoneData.id,
    };

    const { data: feeData, error: feeError } = await supabase
        .from('delivery_fees')
        .upsert(feeDataToUpsert)
        .select()
        .single();
    
    if (feeError) throw feeError;

    return { ...zoneData, delivery_fees: feeData };
};

export const deleteDeliveryZone = async (zoneId: string) => {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', zoneId);
    if (error) throw error;
};
