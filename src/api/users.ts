import { supabase } from '@/integrations/supabase/client';

export interface DispatchRider {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle_type?: string;
  is_active: boolean;
}

export async function getDispatchRiders(): Promise<DispatchRider[]> {
  const { data, error } = await (supabase as any)
    .from('drivers')
    .select('id, name, phone, email, vehicle_type, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}
