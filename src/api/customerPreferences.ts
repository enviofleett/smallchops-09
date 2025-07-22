
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';

export type CustomerCommunicationPreference = Tables<'customer_communication_preferences'>;
export type UpdateCustomerCommunicationPreference = TablesUpdate<'customer_communication_preferences'>;

interface GetCustomerPreferencesParams {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export const getCustomerPreferences = async ({
  page = 1,
  pageSize = 15,
  searchQuery = '',
}: GetCustomerPreferencesParams): Promise<{ preferences: CustomerCommunicationPreference[]; count: number }> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('customer_communication_preferences')
    .select('*', { count: 'exact' });

  if (searchQuery) {
    query = query.ilike('customer_email', `%${searchQuery}%`);
  }

  const { data, error, count } = await query
    .order('customer_email', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('Error fetching customer communication preferences:', error);
    throw new Error(error.message);
  }

  return { preferences: data || [], count: count || 0 };
};


export const updateCustomerPreference = async ({id, updates}: {id: string; updates: UpdateCustomerCommunicationPreference;}): Promise<CustomerCommunicationPreference> => {
  const { data, error } = await supabase
    .from('customer_communication_preferences')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer preference:', error);
    throw new Error(error.message);
  }

  return data;
};
