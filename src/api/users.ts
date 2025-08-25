
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;

export interface DispatchRider {
  id: string; // This will be profile_id for assignment
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  license_number: string;
  vehicle_type: string;
  vehicle_brand: string;
  vehicle_model: string;
  license_plate: string;
  driver_id?: string; // Original driver table ID
}

export const getDispatchRiders = async (): Promise<DispatchRider[]> => {
  console.log('🔍 Fetching dispatch riders from drivers table...');
  
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      profile_id,
      name,
      email,
      phone,
      is_active,
      license_number,
      vehicle_type,
      vehicle_brand,
      vehicle_model,
      license_plate
    `)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error fetching dispatch riders:', error);
    throw new Error(error.message);
  }

  console.log('✅ Dispatch riders fetched:', data?.length || 0, 'riders found');
  
  // Map drivers to dispatch riders with correct profile_id for assignment
  const mappedRiders = (data || []).map(driver => ({
    id: driver.profile_id || driver.id, // Use profile_id for assignment, fallback to driver.id
    name: driver.name || '',
    email: driver.email || '',
    phone: driver.phone || '',
    is_active: driver.is_active,
    license_number: driver.license_number || '',
    vehicle_type: driver.vehicle_type || '',
    vehicle_brand: driver.vehicle_brand || '',
    vehicle_model: driver.vehicle_model || '',
    license_plate: driver.license_plate || '',
    // Keep original driver_id for reference
    driver_id: driver.id
  }));

  return mappedRiders;
};
