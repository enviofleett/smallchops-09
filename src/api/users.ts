
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;

export const getDispatchRiders = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'dispatch_rider');

  if (error) {
    console.error('Error fetching dispatch riders:', error);
    throw new Error(error.message);
  }

  return data || [];
};
