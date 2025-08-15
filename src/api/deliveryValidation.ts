import { supabase } from '@/integrations/supabase/client';

export interface DeliveryAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface DeliveryFeeCalculation {
  zoneId: string;
  baseFee: number;
  distanceFee: number;
  totalFee: number;
  distance?: number;
  freeDeliveryEligible: boolean;
}

/**
 * Calculate delivery fee with enhanced distance-based pricing
 */
export const calculateDeliveryFeeWithDistance = async (
  zoneId: string,
  orderSubtotal: number,
  deliveryAddress?: DeliveryAddress
): Promise<DeliveryFeeCalculation> => {
  try {
    // Get zone and fee information
    const { data: zone, error: zoneError } = await supabase
      .from('delivery_zones')
      .select(`
        *,
        delivery_fees(*)
      `)
      .eq('id', zoneId)
      .eq('is_active', true)
      .single();

    if (zoneError || !zone) {
      throw new Error('Invalid or inactive delivery zone');
    }

    const deliveryFees = Array.isArray(zone.delivery_fees) 
      ? zone.delivery_fees[0] 
      : zone.delivery_fees;

    if (!deliveryFees) {
      return {
        zoneId,
        baseFee: 0,
        distanceFee: 0,
        totalFee: 0,
        freeDeliveryEligible: false
      };
    }

    const { base_fee, fee_per_km, min_order_for_free_delivery } = deliveryFees;

    // Check free delivery eligibility
    const freeDeliveryEligible = min_order_for_free_delivery 
      ? orderSubtotal >= min_order_for_free_delivery 
      : false;

    if (freeDeliveryEligible) {
      return {
        zoneId,
        baseFee: base_fee || 0,
        distanceFee: 0,
        totalFee: 0,
        freeDeliveryEligible: true
      };
    }

    // Calculate distance-based fee
    let distanceFee = 0;
    let calculatedDistance: number | undefined;

    if (fee_per_km && deliveryAddress?.latitude && deliveryAddress?.longitude) {
      // TODO: Integrate with mapping service for real distance calculation
      // For now, use a placeholder calculation
      calculatedDistance = await calculateDistance(zoneId, deliveryAddress);
      distanceFee = calculatedDistance * fee_per_km;
    }

    const totalFee = (base_fee || 0) + distanceFee;

    return {
      zoneId,
      baseFee: base_fee || 0,
      distanceFee,
      totalFee,
      distance: calculatedDistance,
      freeDeliveryEligible: false
    };

  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    throw error;
  }
};

/**
 * Validate if delivery address is within zone boundaries
 */
export const validateAddressInZone = async (
  zoneId: string,
  deliveryAddress: DeliveryAddress
): Promise<boolean> => {
  try {
    if (!deliveryAddress.latitude || !deliveryAddress.longitude) {
      return false; // Cannot validate without coordinates
    }

    // For now, return true as validation would require PostGIS or external service
    // TODO: Implement actual point-in-polygon validation
    // This would call a database function or external mapping service
    return true;
  } catch (error) {
    console.error('Error validating address in zone:', error);
    return false;
  }
};

/**
 * Calculate distance between address and zone center
 * TODO: Replace with actual mapping service integration
 */
const calculateDistance = async (
  zoneId: string,
  deliveryAddress: DeliveryAddress
): Promise<number> => {
  // Placeholder implementation - would integrate with Google Maps, MapBox, etc.
  // For now, return a mock distance based on zone
  
  try {
    const { data: zone } = await supabase
      .from('delivery_zones')
      .select('area')
      .eq('id', zoneId)
      .single();

    if (!zone?.area) {
      return 5; // Default 5km if no zone data
    }

    // Mock calculation - in production this would use:
    // - Google Maps Distance Matrix API
    // - MapBox Directions API
    // - Or PostGIS functions for geographic calculations
    
    return Math.random() * 10 + 2; // Random distance between 2-12km for demo
  } catch {
    return 5; // Default fallback
  }
};

/**
 * Get all active delivery zones with enhanced fee information
 */
export const getActiveDeliveryZones = async () => {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select(`
      *,
      delivery_fees(*)
    `)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return data.map(zone => ({
    ...zone,
    delivery_fees: Array.isArray(zone.delivery_fees) && zone.delivery_fees.length > 0 
      ? zone.delivery_fees[0] 
      : null,
  }));
};