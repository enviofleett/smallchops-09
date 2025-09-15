import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';
import { validateOrderUpdatePayload } from '@/utils/orderValidation';

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
      .from('orders')
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
        .from('orders')
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
  updates: { status?: OrderStatus; assigned_rider_id?: string | null; phone?: string; customer_phone?: string; [key: string]: any }
): Promise<OrderWithItems> => {
  // CRITICAL: Fix field mapping to prevent database column errors
  const sanitizedUpdates = { ...updates };
  
  // Always sanitize phone field to customer_phone for orders table compatibility
  if ('phone' in sanitizedUpdates) {
    console.log('🔧 Mapping phone to customer_phone for orders table compatibility');
    sanitizedUpdates.customer_phone = sanitizedUpdates.phone;
    delete sanitizedUpdates.phone;
  }
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Updating order via production-safe method:', orderId, updates);
    }

    // CRITICAL: Enhanced field validation before sending to backend
    const { isValid, errors, cleanedUpdates, warnings } = validateOrderUpdatePayload(updates, {});
    
    if (!isValid) {
      console.error('❌ Client-side validation failed:', errors);
      throw new Error(Object.values(errors)[0] || 'Invalid update data');
    }

    if (warnings.length > 0) {
      console.warn('⚠️ Update warnings:', warnings);
    }

    const finalUpdates = cleanedUpdates;
    console.log('📤 Sending validated updates to backend:', finalUpdates);

    // If we're assigning a rider, use the secure RPC-based assignment
    if (finalUpdates.assigned_rider_id && finalUpdates.assigned_rider_id !== null) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Assigning/reassigning rider using secure RPC:', finalUpdates.assigned_rider_id);
      }
      
      const { data: assignmentResult, error: assignmentError } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'assign_rider',
          orderId,
          riderId: finalUpdates.assigned_rider_id
        }
      });

      if (assignmentError || !assignmentResult?.success) {
        const errorMsg = assignmentResult?.error || assignmentError?.message || 'Failed to assign rider';
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Rider assignment failed:', errorMsg);
        }
        throw new Error(errorMsg);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Rider assignment successful via secure RPC');
      }

      // If there are other updates besides rider assignment, apply them separately
      const otherUpdates = { ...finalUpdates };
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
          throw new Error(updateResult?.error || updateError?.message || 'Failed to update order');
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
        updates: finalUpdates
      }
    });

    if (error) {
      console.error('❌ Error updating order via admin function:', error);
      // Provide more specific error messaging
      const errorMessage = error.message || 'Edge Function returned a non-2xx status code';
      if (errorMessage.includes('non-2xx status code')) {
        throw new Error('Order update service is temporarily unavailable. Please try again.');
      }
      throw new Error(`Order update failed: ${errorMessage}`);
    }

    if (!data?.success) {
      console.error('❌ Order update failed:', data?.error);
      
      // Enhanced error handling for specific backend responses
      let errorMessage = data?.error || 'Order update failed due to server error';
      if (data?.details) {
        console.error('❌ Update failure details:', data.details);
        if (data.details.rejected_fields) {
          errorMessage += ` (Rejected fields: ${data.details.rejected_fields.join(', ')})`;
        }
      }
      throw new Error(errorMessage);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Order updated successfully via admin function');
    }
    return data.order;
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error updating order via admin function:', error);
    }
    
    // NO FALLBACK: For production security, we only allow updates through the hardened edge function
    throw new Error(`Order update failed: ${error.message}`);
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
