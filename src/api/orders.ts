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
    const { data, error } = await supabase.functions.invoke('order-manager', {
      body: {
        action: 'list_orders',
        admin_id: 'current-user',
        page,
        page_size: pageSize,
        status_filter: status,
        search_query: searchQuery,
        start_date: startDate,
        end_date: endDate
      }
    });

    if (error) {
      console.error('Error fetching orders via admin function:', error);
      throw new Error(error.message || 'Failed to fetch orders');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch orders');
    }

    return { orders: data.orders || [], count: data.count || 0 };
  } catch (error) {
    console.error('Error fetching orders:', error);
    
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
      .order('created_at', { ascending: false })
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
        .order('created_at', { ascending: false })
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
  updates: { status?: OrderStatus; assigned_rider_id?: string | null; customer_phone?: string; [key: string]: any }
): Promise<OrderWithItems> => {
  // Clean up updates object by removing null, undefined, and empty values
  const sanitizedUpdates: Record<string, any> = {};
  
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      sanitizedUpdates[key] = value;
    }
  });
  
  // Phone field mapping no longer needed - phone column removed from database
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Updating order via production-safe method:', orderId, sanitizedUpdates);
    }

    // If we're assigning a rider, use the secure RPC-based assignment
    // Only trigger rider assignment if assigned_rider_id is explicitly provided and valid
    if ('assigned_rider_id' in updates && updates.assigned_rider_id && updates.assigned_rider_id.trim() !== '') {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Assigning/reassigning rider using secure RPC:', updates.assigned_rider_id);
      }
      
      const { data: assignmentResult, error: assignmentError } = await supabase.functions.invoke('order-manager', {
        body: {
          action: 'assign_rider',
          order_id: orderId,
          rider_id: updates.assigned_rider_id,
          admin_id: 'current-user'
        }
      });

      if (assignmentError || !assignmentResult?.success) {
        // Enhanced error handling with structured error response
        let errorMsg = 'Failed to assign rider';
        
        if (assignmentResult?.errorCode) {
          switch (assignmentResult.errorCode) {
            case 'RIDER_NOT_FOUND':
              const availableRiders = assignmentResult.context?.availableRiders || [];
              errorMsg = `Rider not found. ${availableRiders.length > 0 ? 'Available riders: ' + availableRiders.map(r => r.name).join(', ') : 'No active riders available.'}`;
              break;
            case 'RIDER_INACTIVE':
              const riderName = assignmentResult.context?.riderName || 'Selected rider';
              errorMsg = `${riderName} is currently inactive. Please select an active rider.`;
              break;
            case 'START_DELIVERY_FAILED':
            case 'REASSIGN_RIDER_FAILED':
              errorMsg = `${assignmentResult.error || 'Database operation failed'}`;
              break;
            case 'INVALID_ORDER_STATUS':
              const currentStatus = assignmentResult.context?.currentStatus;
              const validStatuses = assignmentResult.context?.validStatuses?.join(', ') || 'confirmed, preparing, ready, out_for_delivery';
              errorMsg = `Cannot assign rider to order with status "${currentStatus}". Valid statuses: ${validStatuses}`;
              break;
            default:
              errorMsg = assignmentResult.error || 'Unknown assignment error';
          }
        } else {
          errorMsg = assignmentResult?.error || assignmentError?.message || 'Failed to assign rider';
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Rider assignment failed:', {
            errorCode: assignmentResult?.errorCode,
            error: errorMsg,
            context: assignmentResult?.context
          });
        }
        throw new Error(errorMsg);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Rider assignment successful via secure RPC');
      }

      // If there are other updates besides rider assignment, apply them separately
      const otherUpdates = { ...sanitizedUpdates };
      delete otherUpdates.assigned_rider_id;
      
      if (Object.keys(otherUpdates).length > 0) {
        const { data: updateResult, error: updateError } = await supabase.functions.invoke('order-manager', {
          body: {
            action: 'update_status',
            order_id: orderId,
            new_status: otherUpdates.status,
            admin_id: 'current-user'
          }
        });

        if (updateError || !updateResult?.success) {
          throw new Error(updateResult?.error || updateError?.message || 'Failed to update order');
        }
        
        return updateResult.order;
      }
      
      return assignmentResult.order;
    }

    // For non-rider updates, use the standard update path with cleaned data
    const { data, error } = await supabase.functions.invoke('order-manager', {
      body: {
        action: 'update_status',
        order_id: orderId,
        new_status: sanitizedUpdates.status,
        admin_id: 'current-user'
      }
    });

    if (error || !data.success) {
      // BULLETPROOF: Enhanced error parsing with better user feedback
      let errorMessage = 'Failed to update order';
      
      // Handle bulletproof function responses
      if (data?.error) {
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else if (data.error.message) {
          errorMessage = data.error.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Special handling for bulletproof function responses
      if (data?.recovery_actions) {
        console.log(`💡 Recovery actions suggested:`, data.recovery_actions);
      }
      
      if (data?.retry_after_seconds) {
        console.log(`⏱️ Retry suggested after ${data.retry_after_seconds} seconds`);
      }
      
      // Enhanced logging for bulletproof diagnostics
      console.error('❌ BULLETPROOF: Order update failed:', {
        orderId,
        updates: sanitizedUpdates,
        error: data?.error || error,
        success: data?.success,
        bulletproof_response: data
      });
      
      throw new Error(errorMessage);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ BULLETPROOF: Order updated successfully via admin function');
    }
    
    // Log bulletproof success metrics
    if (data?.email_queued?.success) {
      console.log('📧 Email notification queued successfully');
    }
    
    if (data?.email_queued?.deduplicated) {
      console.log('🔄 Email notification deduplicated (already queued)');
    }
    return data.order;
    
  } catch (error) {
    console.error('❌ Error updating order via admin function:', error);
    
    // CRITICAL: Add better error handling for production stability
    if (error.message && error.message.includes('delivery schedule recovery')) {
      // Prevent infinite loops by not triggering recovery attempts
      console.warn('🛑 Delivery schedule recovery loop detected, breaking chain');
      throw new Error('Order update failed: Delivery schedule issue detected');
    }
    
    // NO FALLBACK: For production security, we only allow updates through the hardened edge function
    throw new Error(`Order update failed: ${error.message}`);
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  try {
    const { data, error } = await supabase.functions.invoke('order-manager', {
      body: {
        action: 'delete_order',
        order_id: orderId,
        admin_id: 'current-user'
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
    const { data, error } = await supabase.functions.invoke('order-manager', {
      body: {
        action: 'bulk_delete_orders',
        order_ids: orderIds,
        admin_id: 'current-user'
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
  try {
    // Use the bulletproof RPC function to avoid duplicate key violations
    const { data, error } = await supabase.rpc('upsert_communication_event_production', {
      p_event_type: 'order_status_update',
      p_recipient_email: order.customer_email || '',
      p_template_key: `order_${status}`,
      p_template_variables: {
        old_status: order.status,
        new_status: status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        order_number: order.order_number,
        order_id: order.id
      },
      p_order_id: order.id,
      p_source: 'manual_admin_action'
    });

    if (error) {
      console.error('RPC error in manual communication event:', error);
      throw new Error(`Communication event failed: ${error.message}`);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Manual communication event queued successfully:', data);
    }

  } catch (error: any) {
    // Gracefully handle duplicate key errors (23505) - non-blocking
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      console.warn('Duplicate communication event detected (non-blocking):', {
        order_id: order.id,
        status,
        error: error.message
      });
      // Return success - this is expected behavior for duplicate events
      return;
    }

    // Re-throw other errors
    console.error('Error queueing manual communication event:', error);
    throw new Error(error.message || 'Failed to queue communication event');
  }
};
