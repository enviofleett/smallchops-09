import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';

interface OrderWithDeliverySchedule {
  order_id: string;
  delivery_schedule: DeliverySchedule | null;
}

export const useOrderDeliverySchedules = (orderIds: string[]) => {
  const [schedules, setSchedules] = useState<Record<string, DeliverySchedule | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderIds.length === 0) {
      setSchedules({});
      return;
    }

    const fetchSchedules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('order_delivery_schedule')
          .select('*')
          .in('order_id', orderIds);

        if (error) {
          console.error('Error fetching delivery schedules:', error);
          return;
        }

        const schedulesMap: Record<string, DeliverySchedule | null> = {};
        
        // Initialize all orders with null schedules
        orderIds.forEach(id => {
          schedulesMap[id] = null;
        });

        // Map existing schedules
        data.forEach(schedule => {
          schedulesMap[schedule.order_id] = schedule;
        });

        setSchedules(schedulesMap);
      } catch (error) {
        console.error('Error fetching delivery schedules:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [orderIds]);

  return { schedules, loading };
};