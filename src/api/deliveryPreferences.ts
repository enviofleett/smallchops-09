import { supabase } from '@/integrations/supabase/client';

export interface DeliveryPreferences {
  id?: string;
  customer_id: string;
  preferred_delivery_time_start?: string; // Time format "HH:MM"
  preferred_delivery_time_end?: string;
  delivery_instructions?: string;
  preferred_days?: string[];
  contact_phone?: string;
  contact_email?: string;
  notifications_enabled: boolean;
  sms_notifications: boolean;
  email_notifications: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryTimeSlot {
  id?: string;
  zone_id?: string;
  day_of_week: number; // 0=Sunday, 1=Monday, etc.
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PickupPoint {
  id?: string;
  name: string;
  address: string;
  coordinates?: any; // JSON type from Supabase
  contact_phone?: string;
  operating_hours?: any; // JSON type from Supabase
  capacity: number;
  instructions?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Customer Delivery Preferences API
export const getDeliveryPreferences = async (customerId: string): Promise<DeliveryPreferences | null> => {
  const { data, error } = await supabase
    .from('customer_delivery_preferences')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const upsertDeliveryPreferences = async (preferences: Omit<DeliveryPreferences, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryPreferences> => {
  const { data, error } = await supabase
    .from('customer_delivery_preferences')
    .upsert(preferences, { onConflict: 'customer_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Delivery Time Slots API
export const getAvailableTimeSlots = async (zoneId?: string, dayOfWeek?: number): Promise<DeliveryTimeSlot[]> => {
  let query = supabase
    .from('delivery_time_slots')
    .select('*')
    .eq('is_active', true);

  if (zoneId) {
    query = query.eq('zone_id', zoneId);
  }

  if (dayOfWeek !== undefined) {
    query = query.eq('day_of_week', dayOfWeek);
  }

  const { data, error } = await query.order('start_time');

  if (error) throw error;
  return data || [];
};

export const createTimeSlot = async (timeSlot: Omit<DeliveryTimeSlot, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryTimeSlot> => {
  const { data, error } = await supabase
    .from('delivery_time_slots')
    .insert(timeSlot)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTimeSlot = async (id: string, updates: Partial<DeliveryTimeSlot>): Promise<DeliveryTimeSlot> => {
  const { data, error } = await supabase
    .from('delivery_time_slots')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Pickup Points API
export const getPickupPoints = async (): Promise<PickupPoint[]> => {
  const { data, error } = await supabase
    .from('pickup_points')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return (data || []) as any;
};

export const createPickupPoint = async (pickupPoint: Omit<PickupPoint, 'id' | 'created_at' | 'updated_at'>): Promise<PickupPoint> => {
  const { data, error } = await supabase
    .from('pickup_points')
    .insert(pickupPoint)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

export const updatePickupPoint = async (id: string, updates: Partial<PickupPoint>): Promise<PickupPoint> => {
  const { data, error } = await supabase
    .from('pickup_points')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

export const deletePickupPoint = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('pickup_points')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
};