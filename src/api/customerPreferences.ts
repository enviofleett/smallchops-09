import { supabase } from '@/integrations/supabase/client';

export interface CustomerCommunicationPreference {
  id: string;
  customer_email: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  created_at: string;
  updated_at: string;
}

export type UpdateCustomerCommunicationPreference = Partial<CustomerCommunicationPreference>;

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

  let query = (supabase as any)
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
  const { data, error } = await (supabase as any)
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
