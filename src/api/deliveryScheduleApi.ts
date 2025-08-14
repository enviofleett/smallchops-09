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

export const createDeliverySchedule = async (scheduleData: CreateDeliverySchedule & { slot_id?: string }): Promise<DeliverySchedule> => {
  // If slot_id is provided, reserve the slot first
  if (scheduleData.slot_id) {
    const { data: reservationResult, error: reservationError } = await supabase.rpc('reserve_delivery_slot', {
      p_slot_id: scheduleData.slot_id,
      p_order_id: scheduleData.order_id
    });

    if (reservationError || !(reservationResult as any)?.success) {
      throw new Error((reservationResult as any)?.error || 'Failed to reserve delivery slot');
    }
  }

  // Create the delivery schedule
  const { slot_id, ...insertData } = scheduleData;
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // If schedule creation fails and we reserved a slot, release it
    if (scheduleData.slot_id) {
      await supabase.rpc('release_delivery_slot', {
        p_slot_id: scheduleData.slot_id,
        p_order_id: scheduleData.order_id
      });
    }
    throw error;
  }
  
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
  // Get the schedule details first to release the slot
  const { data: schedule, error: fetchError } = await supabase
    .from('order_delivery_schedule')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Delete the schedule (trigger will handle slot release)
  const { error } = await supabase
    .from('order_delivery_schedule')
    .delete()
    .eq('id', id);

  if (error) throw error;
};