import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';

// We define a more specific type for an order that includes its line items and delivery zones.
export type OrderWithItems = Tables<'orders'> & {
  order_items: Tables<'order_items'>[];
  delivery_zones?: Tables<'delivery_zones'> | null;
  delivery_schedule?: {
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
  } | null;
};

interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | 'all';
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetches orders and their associated items from the database with pagination and filtering.
 * Uses admin edge function to bypass RLS for authenticated admin users.
 */
export const getOrders = async ({
  page = 1,
  pageSize = 10,
  status = 'all',
  searchQuery = '',
  startDate,
  endDate,
}: GetOrdersParams): Promise<{ orders: OrderWithItems[]; count: number }> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'list',
        page,
        pageSize,
        status,
        searchQuery,
        startDate,
        endDate
      }
    });

    if (error) {
      // Only log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching orders via admin function:', error);
      }
      throw new Error(error.message || 'Failed to fetch orders');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch orders');
    }

    return { orders: data.orders || [], count: data.count || 0 };
  } catch (error) {
    // Only log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching orders:', error);
    }
    
    // Fallback to direct Supabase query for backward compatibility
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('orders_view')
      .select(`*, 
        order_items (*),
        order_delivery_schedule (*)
      `, { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (searchQuery) {
      const searchString = `%${searchQuery}%`;
      query = query.or(
        `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
      );
    }

    const { data: fallbackData, error: fallbackError, count } = await query
      .order('order_time', { ascending: false })
      .range(from, to);

    // If query with delivery zones fails, try without them and manually fetch
    if (fallbackError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Query with delivery zones failed, trying fallback:', fallbackError.message);
      }
      
      let fallbackQuery = supabase
        .from('orders_view')
        .select(`*, order_items (*), order_delivery_schedule (*)`, { count: 'exact' });

      if (status !== 'all') {
        fallbackQuery = fallbackQuery.eq('status', status);
      }

      if (searchQuery) {
        const searchString = `%${searchQuery}%`;
        fallbackQuery = fallbackQuery.or(
          `order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`
        );
      }

      const { data: noZoneData, error: noZoneError, count: noZoneCount } = await fallbackQuery
        .order('order_time', { ascending: false })
        .range(from, to);

      if (noZoneError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Fallback query also failed:', noZoneError);
        }
        throw new Error(noZoneError.message);
      }

      // Manually fetch delivery zones for each order
      const ordersWithZones = await Promise.all(
        (noZoneData || []).map(async (order: any) => {
          if (order.delivery_zone_id) {
            try {
              const { data: zone } = await supabase
                .from('delivery_zones')
                .select('id, name, base_fee, is_active')
                .eq('id', order.delivery_zone_id)
                .single();
              
              return { ...order, delivery_zones: zone };
            } catch (zoneError) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`Failed to fetch zone for order ${order.id}:`, zoneError);
              }
              return { ...order, delivery_zones: null };
            }
          }
          return { ...order, delivery_zones: null };
        })
      );

      return { orders: ordersWithZones as unknown as OrderWithItems[], count: noZoneCount || 0 };
    }

    return { orders: fallbackData as unknown as OrderWithItems[] || [], count: count || 0 };
  }
};

/**
 * Updates an order with proper rider assignment validation
 */
export const updateOrder = async (
  orderId: string,
  updates: { status?: OrderStatus; assigned_rider_id?: string | null }
): Promise<OrderWithItems> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Updating order via production-safe method:', orderId, updates);
    }

    // If we're assigning a rider, use the secure RPC-based assignment
    if (updates.assigned_rider_id && updates.assigned_rider_id !== null) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Assigning/reassigning rider using secure RPC:', updates.assigned_rider_id);
      }
      
      const { data: assignmentResult, error: assignmentError } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'assign_rider',
          orderId,
          riderId: updates.assigned_rider_id
        }
      });

      if (assignmentError || !assignmentResult?.success) {
        const errorMsg = assignmentResult?.error || assignmentError?.message || 'Failed to assign rider';
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Rider assignment failed:', errorMsg);
        }
        
        // Handle specific permission errors
        if (errorMsg.includes('Only admins') || errorMsg.includes('Insufficient permissions')) {
          throw new Error('Admin permissions required to assign riders. Please contact your administrator.');
        }
        
        throw new Error(errorMsg);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Rider assignment successful via secure RPC');
      }

      // If there are other updates besides rider assignment, apply them separately
      const otherUpdates = { ...updates };
      delete otherUpdates.assigned_rider_id;
      
      if (Object.keys(otherUpdates).length > 0) {
        const { data: updateResult, error: updateError } = await supabase.functions.invoke('admin-orders-manager', {
          body: {
            action: 'update',
            orderId,
            updates: otherUpdates
          }
        });

        if (updateError || !updateResult?.success) {
          const errorMsg = updateResult?.error || updateError?.message || 'Failed to update order';
          
          // Handle specific permission errors
          if (errorMsg.includes('Only admins') || errorMsg.includes('Insufficient permissions')) {
            throw new Error('Admin permissions required to update orders. Please contact your administrator.');
          }
          
          throw new Error(errorMsg);
        }
        
        return updateResult.order;
      }
      
      return assignmentResult.order;
    }

    // For non-rider updates, use the standard update path
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'update',
        orderId,
        updates
      }
    });

    if (error || !data.success) {
      const errorMsg = data?.error || error?.message || 'Failed to update order';
      
      // Handle specific permission errors
      if (errorMsg.includes('Only admins') || errorMsg.includes('Insufficient permissions')) {
        throw new Error('Admin permissions required to update orders. Please contact your administrator.');
      }
      
      throw new Error(errorMsg);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Order updated successfully via admin function');
    }
    return data.order;
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error updating order via admin function:', error);
    }
    
    // Fallback to direct update with enhanced validation
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Attempting fallback direct update with validation...');
      }
      
      // If assigning rider, validate first
      if (updates.assigned_rider_id && updates.assigned_rider_id !== null) {
        const { data: riderCheck, error: riderError } = await supabase
          .from('drivers')
          .select('id, is_active')
          .eq('id', updates.assigned_rider_id)
          .single();

        if (riderError || !riderCheck) {
          throw new Error(`Invalid rider ID: ${updates.assigned_rider_id}`);
        }

        if (!riderCheck.is_active) {
          throw new Error(`Rider ${updates.assigned_rider_id} is not active`);
        }
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select(`*, 
          order_items (*),
          delivery_zones (id, name, base_fee, is_active),
          order_delivery_schedule (*)
        `)
        .maybeSingle();

      if (fallbackError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Fallback update also failed:', fallbackError);
        }
        throw new Error(fallbackError.message);
      }

      if (!fallbackData) {
        throw new Error('Order not found');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Fallback update successful');
      }
      return fallbackData as unknown as OrderWithItems;
      
    } catch (fallbackError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('💥 All update methods failed:', fallbackError);
      }
      throw fallbackError;
    }
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'delete',
        orderId
      }
    });

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete order');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error deleting order via admin function:', error);
    }
    
    // Fallback to direct delete
    const { error: fallbackError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (fallbackError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Fallback delete also failed:', fallbackError);
      }
      throw new Error(fallbackError.message);
    }
  }
};

export const bulkDeleteOrders = async (orderIds: string[]): Promise<void> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'bulk_delete',
        orderIds
      }
    });

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete orders');
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error bulk deleting orders via admin function:', error);
    }
    
    // Fallback to direct delete
    const { error: fallbackError } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds);

    if (fallbackError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Fallback bulk delete also failed:', fallbackError);
      }
      throw new Error(fallbackError.message);
    }
  }
};

export const manuallyQueueCommunicationEvent = async (
  order: OrderWithItems,
  status: OrderStatus
): Promise<void> => {
  const { error } = await supabase.from('communication_events').insert({
    order_id: order.id,
    event_type: 'order_status_update', // Re-using to leverage existing processor
    payload: {
      old_status: order.status,
      new_status: status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
    },
  });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error queueing manual communication event:', error);
    }
    throw new Error(error.message);
  }
};
