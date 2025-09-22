import { supabase } from '@/integrations/supabase/client';
import { OrderStatus } from '@/types/orders';
import { OrderWithItems } from '@/api/orders';
import { adaptNewOrdersToOld } from '@/utils/orderDataAdapter';

interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | 'all';
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Adapter function that uses the new order-manager edge function
 * but provides the old API interface for backward compatibility
 */
export const getOrdersViaNewBackend = async ({
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
        status_filter: status === 'all' ? 'all' : status,
        search_query: searchQuery || '',
        start_date: startDate,
        end_date: endDate
      }
    });

    if (error) {
      console.error('Error fetching orders via new backend:', error);
      throw new Error(error.message || 'Failed to fetch orders');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch orders');
    }

    // Adapt the new data structure to old format
    const adaptedOrders = adaptNewOrdersToOld(data.data.orders || []);

    return { 
      orders: adaptedOrders, 
      count: data.data.total_count || 0 
    };
  } catch (error) {
    console.error('Error in orders adapter:', error);
    throw error;
  }
};

/**
 * Adapter for updating orders using new backend
 */
export const updateOrderViaNewBackend = async (
  orderId: string,
  updates: { status?: OrderStatus; assigned_rider_id?: string | null; [key: string]: any }
): Promise<OrderWithItems> => {
  try {
    const { data, error } = await supabase.functions.invoke('order-manager', {
      body: {
        action: 'update_status',
        order_id: orderId,
        new_status: updates.status,
        admin_id: 'current-user'
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to update order');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to update order');
    }

    // Return adapted order (data.order would contain the updated order)
    return data.order;
  } catch (error) {
    console.error('Error updating order via new backend:', error);
    throw error;
  }
};