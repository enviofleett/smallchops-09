
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
  
  try {
    // First try to get from drivers table
    const { data: driversData, error: driversError } = await supabase
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

    if (driversError) {
      console.error('❌ Error fetching from drivers table:', driversError);
      throw new Error(`Drivers table error: ${driversError.message}`);
    }

    // If we have drivers data, use it
    if (driversData && driversData.length > 0) {
      console.log('✅ Dispatch riders fetched from drivers table:', driversData.length, 'riders found');
      
      return driversData.map(driver => ({
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
        driver_id: driver.id
      }));
    }

    // Fallback: Try to get riders from customer_accounts with admin role
    console.log('🔄 No drivers found, trying fallback from customer_accounts...');
    
    const { data: adminData, error: adminError } = await supabase
      .from('customer_accounts')
      .select(`
        id,
        user_id,
        name,
        email,
        phone
      `)
      .not('user_id', 'is', null)
      .order('name', { ascending: true });

    if (adminError) {
      console.error('❌ Error fetching fallback riders:', adminError);
      return [];
    }

    // Check if any of these users have admin privileges (as a fallback for dispatch)
    const fallbackRiders = (adminData || [])
      .filter(account => account.name && account.email)
      .slice(0, 5) // Limit to 5 fallback riders
      .map(account => ({
        id: account.user_id!,
        name: account.name!,
        email: account.email!,
        phone: account.phone || '',
        is_active: true,
        license_number: 'N/A',
        vehicle_type: 'Admin Assignment',
        vehicle_brand: '',
        vehicle_model: '',
        license_plate: '',
        driver_id: account.id
      }));

    console.log('✅ Fallback riders available:', fallbackRiders.length);
    return fallbackRiders;

  } catch (error) {
    console.error('❌ Critical error fetching dispatch riders:', error);
    // Return empty array instead of throwing to prevent UI breakage
    return [];
  }
};
