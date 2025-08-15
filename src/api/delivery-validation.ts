import { supabase } from '@/integrations/supabase/client';
import { DeliveryZoneWithFee } from './delivery';

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}

export interface DeliveryValidationResult {
  isValid: boolean;
  zone?: DeliveryZoneWithFee;
  fee: number;
  distance?: number;
  estimatedTime?: number;
  error?: string;
}

/**
 * Validate if a delivery address is within any active delivery zone
 * and calculate the appropriate delivery fee
 */
export const validateDeliveryAddress = async (
  address: DeliveryAddress,
  orderSubtotal: number
): Promise<DeliveryValidationResult> => {
  try {
    // For production, this would integrate with a geocoding service
    // to get precise coordinates if not provided
    const { latitude, longitude } = address;
    
    if (!latitude || !longitude) {
      return {
        isValid: false,
        fee: 0,
        error: 'Address coordinates required for delivery validation'
      };
    }

    // Get all active delivery zones
    const { data: zones, error } = await supabase
      .from('delivery_zones')
      .select(`
        *,
        delivery_fees(*)
      `)
      .eq('is_active', true);

    if (error) throw error;

    // Find the zone that contains this address
    // In production, this would use proper geometric calculations
    // For now, we'll return the first zone as a placeholder
    const zone = zones?.[0];
    
    if (!zone || !zone.delivery_fees?.[0]) {
      return {
        isValid: false,
        fee: 0,
        error: 'No delivery zones available for this address'
      };
    }

    const zoneWithFee: DeliveryZoneWithFee = {
      ...zone,
      delivery_fees: zone.delivery_fees[0]
    };

    // Calculate delivery fee manually for now since the DB function isn't in the types yet
    const deliveryFees = zoneWithFee.delivery_fees;
    let calculatedFee = deliveryFees.base_fee;
    
    // Check for free delivery threshold
    if (deliveryFees.min_order_for_free_delivery && orderSubtotal >= deliveryFees.min_order_for_free_delivery) {
      calculatedFee = 0;
    } else if (deliveryFees.fee_per_km) {
      // Add distance-based fee (using placeholder distance)
      calculatedFee += deliveryFees.fee_per_km * 5;
    }

    return {
      isValid: true,
      zone: zoneWithFee,
      fee: calculatedFee,
      distance: 5, // Placeholder
      estimatedTime: 30 // Placeholder - 30 minutes
    };

  } catch (error) {
    console.error('Error validating delivery address:', error);
    return {
      isValid: false,
      fee: 0,
      error: 'Failed to validate delivery address'
    };
  }
};

/**
 * Get delivery estimate for a specific zone without full address validation
 */
export const getDeliveryEstimate = async (
  zoneId: string,
  orderSubtotal: number,
  distanceKm?: number
): Promise<{ fee: number; estimatedTime: number }> => {
  try {
    // Get zone and fee information
    const { data: zoneData, error } = await supabase
      .from('delivery_zones')
      .select(`
        *,
        delivery_fees(*)
      `)
      .eq('id', zoneId)
      .eq('is_active', true)
      .single();

    if (error || !zoneData?.delivery_fees?.[0]) {
      return { fee: 0, estimatedTime: 30 };
    }

    const deliveryFees = zoneData.delivery_fees[0];
    let calculatedFee = deliveryFees.base_fee;
    
    // Check for free delivery threshold
    if (deliveryFees.min_order_for_free_delivery && orderSubtotal >= deliveryFees.min_order_for_free_delivery) {
      calculatedFee = 0;
    } else if (deliveryFees.fee_per_km) {
      // Add distance-based fee
      calculatedFee += deliveryFees.fee_per_km * (distanceKm || 5);
    }

    return {
      fee: calculatedFee,
      estimatedTime: Math.max(20, (distanceKm || 5) * 4) // 4 minutes per km, minimum 20 minutes
    };
  } catch (error) {
    console.error('Error getting delivery estimate:', error);
    return { fee: 0, estimatedTime: 30 };
  }
};