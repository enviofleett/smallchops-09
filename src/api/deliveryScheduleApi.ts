import { supabase } from '@/integrations/supabase/client';

export interface CreateDeliverySchedule {
  order_id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  is_flexible?: boolean;
  special_instructions?: string;
}

export interface DeliverySchedule {
  id: string;
  order_id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  requested_at: string;
  is_flexible: boolean;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export const createDeliverySchedule = async (scheduleData: CreateDeliverySchedule): Promise<DeliverySchedule> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .insert(scheduleData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const upsertDeliverySchedule = async (scheduleData: CreateDeliverySchedule): Promise<DeliverySchedule> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .upsert(scheduleData, { onConflict: 'order_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getDeliveryScheduleByOrderId = async (orderId: string): Promise<DeliverySchedule | null> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const updateDeliverySchedule = async (
  id: string, 
  updates: Partial<CreateDeliverySchedule>
): Promise<DeliverySchedule> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteDeliverySchedule = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('order_delivery_schedule')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getSchedulesByOrderIds = async (orderIds: string[]): Promise<Record<string, DeliverySchedule>> => {
  if (orderIds.length === 0) return {};

  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .select('*')
    .in('order_id', orderIds);

  if (error) throw error;
  
  // Convert array to map for easy lookup
  return (data || []).reduce((acc, schedule) => {
    acc[schedule.order_id] = schedule;
    return acc;
  }, {} as Record<string, DeliverySchedule>);
};