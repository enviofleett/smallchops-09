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

export interface OrderWithDeliverySchedule {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  payment_status: string;
  total_amount: number;
  delivery_address: any;
  order_time: string;
  order_type: string;
  created_at: string;
  assigned_rider_id?: string;
  order_items: any[];
  delivery_schedule?: DeliverySchedule;
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

export const getDeliveryScheduleByOrderId = async (orderId: string): Promise<DeliverySchedule | null> => {
  const { data, error } = await supabase
    .from('order_delivery_schedule')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getOrdersWithDeliverySchedule = async (filters: {
  startDate?: string;
  endDate?: string;
  status?: string[];
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  timeSlot?: 'all' | 'morning' | 'afternoon' | 'evening';
  urgency?: 'all' | 'urgent' | 'due_today' | 'upcoming';
}): Promise<{ orders: OrderWithDeliverySchedule[]; total: number }> => {
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        customizations,
        special_instructions
      ),
      order_delivery_schedule (
        id,
        delivery_date,
        delivery_time_start,
        delivery_time_end,
        requested_at,
        is_flexible,
        special_instructions,
        created_at,
        updated_at
      )
    `)
    .eq('order_type', 'delivery'); // FIXED: Show ALL delivery orders, not just "ready" ones

  // Date filtering - properly filter by delivery schedule dates
  if (filters.startDate || filters.endDate) {
    // Apply date filters to delivery schedule when specified
    if (filters.startDate && filters.endDate) {
      // Range filter (e.g., today, tomorrow, this week)
      if (filters.startDate === filters.endDate) {
        // Single day filter
        query = query.eq('order_delivery_schedule.delivery_date', filters.startDate);
      } else {
        // Date range filter
        query = query
          .gte('order_delivery_schedule.delivery_date', filters.startDate)
          .lte('order_delivery_schedule.delivery_date', filters.endDate);
      }
    } else if (filters.startDate) {
      query = query.gte('order_delivery_schedule.delivery_date', filters.startDate);
    } else if (filters.endDate) {
      query = query.lte('order_delivery_schedule.delivery_date', filters.endDate);
    }
  }

  // Status filtering
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status as any);
  }

  // Search query filtering
  if (filters.searchQuery) {
    const searchTerm = `%${filters.searchQuery.toLowerCase()}%`;
    query = query.or(`order_number.ilike.${searchTerm},customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm}`);
  }

  // Pagination
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  query = query.range(start, end);

  // Order by created date for consistent ordering (supports both scheduled and unscheduled)
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  // Transform data to include delivery_schedule as a direct property
  let transformedData = data?.map(order => ({
    ...order,
    order_items: order.order_items || [],
    delivery_schedule: order.order_delivery_schedule?.[0] ? {
      ...order.order_delivery_schedule[0],
      order_id: order.id
    } : null
  })) || [];

  // Apply client-side filtering for time slot and urgency (more precise control)
  if (filters.timeSlot && filters.timeSlot !== 'all') {
    transformedData = transformedData.filter(order => {
      // Include orders without delivery schedules when no specific time filtering
      if (!order.delivery_schedule?.delivery_time_start) return false;
      
      try {
        const startHour = parseInt(order.delivery_schedule.delivery_time_start.split(':')[0]);
        
        switch (filters.timeSlot) {
          case 'morning':
            return startHour >= 6 && startHour < 12;
          case 'afternoon':
            return startHour >= 12 && startHour < 18;
          case 'evening':
            return startHour >= 18 && startHour <= 22;
          default:
            return true;
        }
      } catch (error) {
        console.warn('Error parsing delivery time:', order.delivery_schedule.delivery_time_start);
        return false; // Exclude malformed time data
      }
    });
  }

  // Apply urgency filtering based on delivery time
  if (filters.urgency && filters.urgency !== 'all') {
    const now = new Date();
    
    transformedData = transformedData.filter(order => {
      if (!order.delivery_schedule) return false;
      
      try {
        const deliveryDate = new Date(order.delivery_schedule.delivery_date);
        
        // Validate date
        if (isNaN(deliveryDate.getTime())) {
          console.warn('Invalid delivery date:', order.delivery_schedule.delivery_date);
          return false;
        }
        
        const [startHours, startMinutes] = order.delivery_schedule.delivery_time_start.split(':').map(Number);
        
        // Validate time components
        if (isNaN(startHours) || isNaN(startMinutes)) {
          console.warn('Invalid delivery time:', order.delivery_schedule.delivery_time_start);
          return false;
        }
        
        deliveryDate.setHours(startHours, startMinutes, 0, 0);
        
        const hoursUntilDelivery = (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const isToday = deliveryDate.toDateString() === now.toDateString();
        
        switch (filters.urgency) {
          case 'urgent':
            return hoursUntilDelivery <= 2 && hoursUntilDelivery > 0;
          case 'due_today':
            return isToday;
          case 'upcoming':
            return hoursUntilDelivery > 2;
          default:
            return true;
        }
      } catch (error) {
        console.warn('Error processing delivery schedule for urgency filter:', error);
        return false; // Exclude orders with malformed schedule data
      }
    });
  }

  // For filtered results, we need to get the correct total count
  let totalCount = transformedData.length;
  
  // If we applied client-side filters, the total should be the filtered count
  // Otherwise use the database count for unfiltered results
  if (!filters.timeSlot || filters.timeSlot === 'all') {
    if (!filters.urgency || filters.urgency === 'all') {
      totalCount = count || 0; // Use database count when no client-side filtering
    }
  }

  return {
    orders: transformedData,
    total: totalCount
  };
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