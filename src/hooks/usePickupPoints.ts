import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  contact_phone?: string;
  operating_hours?: any;
  instructions?: string;
  is_active?: boolean;
}

export const usePickupPoints = () => {
  return useQuery({
    queryKey: ['pickup-points'],
    queryFn: async (): Promise<PickupPoint[]> => {
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching pickup points:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const usePickupPoint = (pickupPointId?: string) => {
  return useQuery({
    queryKey: ['pickup-point', pickupPointId],
    queryFn: async (): Promise<PickupPoint | null> => {
      if (!pickupPointId) return null;

      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('id', pickupPointId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching pickup point:', error);
        // Don't throw error if pickup point is not found, just return null
        return null;
      }

      return data;
    },
    enabled: !!pickupPointId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};