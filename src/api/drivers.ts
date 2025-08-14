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
  sendInvitation?: boolean; // New field for dispatch integration
}

export const getDrivers = async (): Promise<Driver[]> => {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []) as Driver[];
};

export const createDriver = async (driver: NewDriver): Promise<Driver> => {
  // If this is a dispatch driver with email, use the enhanced creation
  if (driver.email && driver.sendInvitation) {
    const { createDispatchDriver } = await import('@/api/dispatchApi');
    const result = await createDispatchDriver(
      { ...driver, email: driver.email } as any,
      driver.sendInvitation
    );
    
    // Fetch the created driver data
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', result.driverId)
      .single();
      
    if (error) throw error;
    return data as Driver;
  }
  
  // Standard driver creation for non-dispatch drivers
  const { data, error } = await supabase
    .from('drivers')
    .insert(driver)
    .select()
    .single();

  if (error) throw error;
  return data as Driver;
};

export const updateDriver = async (id: string, updates: Partial<Driver>): Promise<Driver> => {
  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Driver;
};

export const deleteDriver = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id);

  if (error) throw error;
};