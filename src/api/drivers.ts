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
    .from('drivers' as any)
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []) as unknown as Driver[];
};

export const createDriver = async (driver: NewDriver): Promise<Driver> => {
  const { data, error } = await supabase
    .from('drivers' as any)
    .insert(driver)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Driver;
};

export const updateDriver = async (id: string, updates: Partial<Driver>): Promise<Driver> => {
  const { data, error } = await supabase
    .from('drivers' as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Driver;
};

export const deleteDriver = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('drivers' as any)
    .delete()
    .eq('id', id);

  if (error) throw error;
};