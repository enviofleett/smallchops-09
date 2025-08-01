import { supabase } from '@/integrations/supabase/client';

export interface Driver {
  id: string;
  profile_id?: string;
  name: string;
  phone: string;
  email?: string;
  license_number?: string;
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'van';
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
  is_active: boolean;
  current_location?: any;
  created_at: string;
  updated_at: string;
}

export interface NewDriver {
  name: string;
  phone: string;
  email?: string;
  license_number?: string;
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'van';
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
  is_active?: boolean;
}

export const getDrivers = async (): Promise<Driver[]> => {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
};

export const createDriver = async (driver: NewDriver): Promise<Driver> => {
  const { data, error } = await supabase
    .from('drivers')
    .insert(driver)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateDriver = async (id: string, updates: Partial<Driver>): Promise<Driver> => {
  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteDriver = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const assignVehicleToDriver = async (driverId: string, vehicleId: string, notes?: string) => {
  // First deactivate any existing assignments for this vehicle
  await supabase
    .from('vehicle_assignments')
    .update({ is_active: false, unassigned_at: new Date().toISOString() })
    .eq('vehicle_id', vehicleId)
    .eq('is_active', true);

  // Create new assignment
  const { data, error } = await supabase
    .from('vehicle_assignments')
    .insert({
      driver_id: driverId,
      vehicle_id: vehicleId,
      notes,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getDriverWithVehicle = async (driverId: string) => {
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      *,
      vehicle_assignments!inner(
        *,
        vehicles(*)
      )
    `)
    .eq('id', driverId)
    .eq('vehicle_assignments.is_active', true)
    .single();

  if (error) throw error;
  return data;
};