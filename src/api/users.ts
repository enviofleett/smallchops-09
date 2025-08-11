
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;

export interface DispatchRider {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  license_number: string;
  vehicle_type: string;
  vehicle_brand: string;
  vehicle_model: string;
  license_plate: string;
}

export const getDispatchRiders = async (): Promise<DispatchRider[]> => {
  console.log('🔍 Fetching dispatch riders from drivers table...');
  
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error fetching dispatch riders:', error);
    throw new Error(error.message);
  }

  console.log('✅ Dispatch riders fetched:', data?.length || 0, 'riders found');
  return data || [];
};
