import { supabase } from '@/integrations/supabase/client';

export interface PublicHoliday {
  id?: string;
  date: string; // YYYY-MM-DD format
  name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const getPublicHolidays = async (year?: number): Promise<PublicHoliday[]> => {
  try {
    let query = (supabase as any)
      .from('public_holidays')
      .select('*')
      .eq('is_active', true)
      .order('date');

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as PublicHoliday[];
  } catch (error) {
    console.error('Failed to fetch public holidays:', error);
    return [];
  }
};

export const createPublicHoliday = async (holiday: Omit<PublicHoliday, 'id' | 'created_at' | 'updated_at'>): Promise<PublicHoliday> => {
  const { data, error } = await (supabase as any)
    .from('public_holidays')
    .insert(holiday)
    .select()
    .single();

  if (error) throw error;
  return data as PublicHoliday;
};

export const updatePublicHoliday = async (id: string, updates: Partial<PublicHoliday>): Promise<PublicHoliday> => {
  const { data, error } = await (supabase as any)
    .from('public_holidays')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as PublicHoliday;
};

export const deletePublicHoliday = async (id: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from('public_holidays')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
};