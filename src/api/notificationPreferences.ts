import { supabase } from '@/integrations/supabase/client';

export interface NotificationPreferences {
  id?: string;
  customer_id: string;
  price_alerts: boolean;
  promotion_alerts: boolean;
  digest_frequency: string;
  minimum_discount_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export type DigestFrequency = 'daily' | 'weekly' | 'monthly';

export const getNotificationPreferences = async (customerId: string): Promise<NotificationPreferences | null> => {
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

export const createNotificationPreferences = async (preferences: Omit<NotificationPreferences, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationPreferences> => {
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .insert(preferences)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const updateNotificationPreferences = async (customerId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .update(preferences)
    .eq('customer_id', customerId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const upsertNotificationPreferences = async (preferences: Omit<NotificationPreferences, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationPreferences> => {
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .upsert(preferences, { onConflict: 'customer_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};