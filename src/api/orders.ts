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
// Enhanced retry mechanism with fresh token and exponential backoff
const retryWithFreshToken = async (operation: () => Promise<any>, maxRetries: number = 3): Promise<any> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Check if the result indicates an auth error
      if (result.error && (
        result.error.code === 'AUTH_TOKEN_EXPIRED' ||
        result.error.code === 'AUTH_SESSION_MISSING' ||
        result.error.code === 'AUTH_TOKEN_INVALID' ||
        result.error.code === 'AUTH_TOKEN_MALFORMED'
      )) {
        console.warn(`Auth token issue detected on attempt ${attempt}, refreshing session...`);
        
        // Try to refresh the session
        await supabase.auth.refreshSession();
        
        // If this isn't the last attempt, continue to retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      
      return result;
    } catch (error: any) {
      console.warn(`Attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      // Don't retry for certain non-transient errors
      if (error.message?.includes('not found') || 
          error.message?.includes('Invalid status') ||
          error.message?.includes('Missing required fields') ||
          error.message?.includes('Access denied') ||
          error.message?.includes('Forbidden')) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError;
};

export const getOrders = async (params: GetOrdersParams = {}) => {
  try {
    const result = await retryWithFreshToken(async () => {
      return await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'list',
          ...params
        }
      });
    });
    
    const { data, error } = result;

    if (error) {
      console.error('❌ Supabase function error:', error);
      throw new Error(`Function invocation failed: ${error.message}`);
    }

    if (!data || !data.success) {
      console.error('❌ Function returned error:', data);
      throw new Error(data?.error || 'Unknown error occurred');
    }

    console.log('✅ Orders fetched successfully via Edge Function');
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching orders via admin function:', error);
    
    // Fallback to direct query for development/debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Falling back to direct query...');
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          delivery_zones (*)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }

      if (params.searchQuery) {
        query = query.or(`order_number.ilike.%${params.searchQuery}%,customer_name.ilike.%${params.searchQuery}%,customer_email.ilike.%${params.searchQuery}%`);
      }

      if (params.startDate) {
        query = query.gte('created_at', params.startDate);
      }

      if (params.endDate) {
        query = query.lte('created_at', params.endDate);
      }

      // Add pagination
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.range(from, to);

      const { data: fallbackData, error: fallbackError, count } = await query;

      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        throw new Error(fallbackError.message);
      }

      // Try to get delivery zones for fallback data
      if (fallbackData && fallbackData.length > 0) {
        const { data: zonesData } = await supabase
          .from('delivery_zones')
          .select('*')
          .in('id', fallbackData.map(order => order.delivery_zone_id).filter(Boolean));

        const zonesMap = new Map(zonesData?.map(zone => [zone.id, zone]) || []);
        
        const ordersWithZones = fallbackData.map(order => ({
          ...order,
          delivery_zones: order.delivery_zone_id ? zonesMap.get(order.delivery_zone_id) : null
        }));

        // Get total count for pagination
        const { count: noZoneCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true });

        return { orders: ordersWithZones as unknown as OrderWithItems[], count: noZoneCount || 0 };
      }

      return { orders: fallbackData as unknown as OrderWithItems[] || [], count: count || 0 };
    }

    throw error;
  }
};

/**
 * Updates an order with proper rider assignment validation
 */
export const updateOrder = async (
  orderId: string,
  updates: { status?: OrderStatus; assigned_rider_id?: string | null; phone?: string; customer_phone?: string; [key: string]: any }
): Promise<OrderWithItems> => {
  console.log('🔄 Starting order update:', orderId, updates);
  
  // Validate required parameters
  if (!orderId || orderId.trim() === '') {
    throw new Error('Order ID is required');
  }

  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    throw new Error('Updates are required');
  }

  // Clean and validate updates - filter out invalid values
  const cleanedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
    // Skip undefined, null, empty string, or 'undefined' string values
    if (value !== undefined && 
        value !== null && 
        value !== '' && 
        value !== 'undefined' && 
        value !== 'null') {
      acc[key] = value;
    } else {
      console.warn(`⚠️ Filtering out invalid value for ${key}:`, value);
    }
    return acc;
  }, {} as Record<string, any>);

  // Check if we have any valid updates after cleaning
  if (Object.keys(cleanedUpdates).length === 0) {
    throw new Error('No valid updates provided after validation');
  }

  // CRITICAL: Fix field mapping to prevent database column errors
  const sanitizedUpdates = { ...cleanedUpdates };
  console.log('🔄 Starting order update:', orderId, updates);
  
  // Validate required parameters
  if (!orderId || orderId.trim() === '') {
    throw new Error('Order ID is required');
  }

  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    throw new Error('Updates are required');
  }

  // Clean and validate updates - filter out invalid values
  const cleanedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
    // Skip undefined, null, empty string, or 'undefined' string values
    if (value !== undefined && 
        value !== null && 
        value !== '' && 
        value !== 'undefined' && 
        value !== 'null') {
      acc[key] = value;
    } else {
      console.warn(`⚠️ Filtering out invalid value for ${key}:`, value);
    }
    return acc;
  }, {} as Record<string, any>);

  // Check if we have any valid updates after cleaning
  if (Object.keys(cleanedUpdates).length === 0) {
    throw new Error('No valid updates provided after validation');
  }

  // CRITICAL: Fix field mapping to prevent database column errors
  const sanitizedUpdates = { ...cleanedUpdates };
  
  // Always sanitize phone field to customer_phone for orders table compatibility
  if ('phone' in sanitizedUpdates) {
    console.log('🔧 Mapping phone to customer_phone for orders table compatibility');
    sanitizedUpdates.customer_phone = sanitizedUpdates.phone;
    delete sanitizedUpdates.phone;
  }

  // Retry logic for transient errors
  let lastError: Error;
  const maxRetries = 3;
  const retryDelays = [1000, 2000, 3000]; // 1s, 2s, 3s
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Order update attempt ${attempt + 1}:`, orderId, sanitizedUpdates);

      // If we're assigning a rider, use the secure RPC-based assignment
      if (sanitizedUpdates.assigned_rider_id && sanitizedUpdates.assigned_rider_id !== null) {
        console.log('🎯 Assigning/reassigning rider using secure RPC:', sanitizedUpdates.assigned_rider_id);
        
        const assignmentResult = await retryWithFreshToken(async () => {
          return await supabase.functions.invoke('admin-orders-manager', {
            body: {
              action: 'assign_rider',
              orderId,
              riderId: sanitizedUpdates.assigned_rider_id
            }
          });
        });
        
        const { data, error: assignmentError } = assignmentResult;

        if (assignmentError || !data?.success) {
          const errorMsg = data?.error || assignmentError?.message || 'Failed to assign rider';
          throw new Error(errorMsg);
        }

        console.log('✅ Rider assignment successful via secure RPC');

        // If there are other updates besides rider assignment, apply them separately
        const otherUpdates = { ...sanitizedUpdates };
        delete otherUpdates.assigned_rider_id;
        
        if (Object.keys(otherUpdates).length > 0) {
          const updateResult = await retryWithFreshToken(async () => {
            return await supabase.functions.invoke('admin-orders-manager', {
              body: {
                action: 'update',
                orderId,
                updates: otherUpdates
              }
            });
          });
          
          const { data: updateData, error: updateError } = updateResult;

          if (updateError || !updateData?.success) {
            throw new Error(updateData?.error || updateError?.message || 'Failed to update order');
          }
          
          return updateData.order;
        }
        
        return data.order;
      }

      // For non-rider updates, use the standard update path
      const result = await retryWithFreshToken(async () => {
        return await supabase.functions.invoke('admin-orders-manager', {
          body: {
            action: 'update',
            orderId,
            updates: sanitizedUpdates
          }
        });
      });
      
      const { data, error } = result;

      if (error) {
        console.error('❌ Supabase function error:', error);
        throw new Error(`Function invocation failed: ${error.message}`);
      }

      if (!data || !data.success) {
        console.error('❌ Function returned error:', data);
        throw new Error(data?.error || 'Unknown error occurred');
      }

      console.log('✅ Order updated successfully via Edge Function');
      return data.order;

    } catch (error: any) {
      console.warn(`⚠️ Order update attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // Don't retry for permanent errors (client-side issues)
      if (error.message.includes('Order ID is required') ||
          error.message.includes('No valid updates') ||
          error.message.includes('not found') || 
          error.message.includes('Invalid status update') ||
          error.message.includes('Access denied') ||
          error.message.includes('Forbidden')) {
        console.error('❌ Permanent error, not retrying:', error.message);
        throw error;
      }
      
      // Use exponential backoff for retries
      if (attempt < maxRetries - 1) {
        const baseDelay = retryDelays[attempt] || 1000;
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
        console.log(`⏳ Waiting ${exponentialDelay}ms before retry ${attempt + 2}`);
        await new Promise(resolve => setTimeout(resolve, exponentialDelay));
      }
    }
  }
  
  // All retries failed - provide user-friendly error messages
  console.error('❌ All update attempts failed:', lastError?.message || 'Unknown error');
  
  // Categorize errors for better user experience
  const errorMessage = lastError?.message || 'Unknown error occurred';
  
  if (errorMessage.includes('duplicate key') || errorMessage.includes('being processed')) {
    throw new Error('Order is being processed by another admin. Please refresh and try again.');
  } else if (errorMessage.includes('non-2xx status code') || errorMessage.includes('Server error')) {
    throw new Error('Order service is temporarily busy. Please try again in a moment.');
  } else if (errorMessage.includes('timeout')) {
    throw new Error('Request timed out. Please check your connection and try again.');
  } else if (errorMessage.includes('Network error') || errorMessage.includes('network')) {
    throw new Error('Network connection issue. Please check your internet and try again.');
  } else if (errorMessage.includes('Database temporarily unavailable')) {
    throw new Error('Database service is temporarily unavailable. Please try again in a few moments.');
  } else {
    throw new Error(`Order update failed: ${errorMessage}`);
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  try {
    const result = await retryWithFreshToken(async () => {
      return await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'delete',
          orderId
        }
      });
    });
    
    const { data, error } = result;

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete order');
    }
  } catch (error: any) {
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
    const result = await retryWithFreshToken(async () => {
      return await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'bulk_delete',
          orderIds
        }
      });
    });
    
    const { data, error } = result;

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to delete orders');
    }
  } catch (error: any) {
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