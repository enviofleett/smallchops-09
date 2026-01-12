import { supabase } from '@/integrations/supabase/client';

export interface CartSession {
  id: string;
  session_id: string;
  customer_email?: string;
  customer_phone?: string;
  customer_id?: string;
  cart_data: any;
  total_items: number;
  total_value: number;
  is_abandoned: boolean;
  abandoned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AbandonedCartFilters {
  timeRange?: 'hour' | 'day' | 'week' | 'all';
  minValue?: number;
  page?: number;
  pageSize?: number;
}

export const getAbandonedCarts = async (filters: AbandonedCartFilters = {}): Promise<{ carts: CartSession[]; count: number }> => {
  const { timeRange = 'all', minValue = 0, page = 1, pageSize = 20 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = (supabase as any)
    .from('cart_sessions')
    .select('*', { count: 'exact' })
    .eq('is_abandoned', true)
    .gte('total_value', minValue)
    .gt('total_items', 0);

  // Apply time range filter
  if (timeRange !== 'all') {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (timeRange) {
      case 'hour':
        cutoffDate = new Date(now.getTime() - (60 * 60 * 1000));
        break;
      case 'day':
        cutoffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case 'week':
        cutoffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      default:
        cutoffDate = now;
    }
    
    query = query.gte('abandoned_at', cutoffDate.toISOString());
  }

  const { data, error, count } = await query
    .order('abandoned_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching abandoned carts:', error);
    throw new Error(error.message);
  }

  return { 
    carts: data || [], 
    count: count || 0 
  };
};

export const trackCartSession = async (cartData: {
  sessionId: string;
  customerEmail?: string;
  customerPhone?: string;
  cartData: any[];
  totalItems: number;
  totalValue: number;
  customerId?: string;
}) => {
  try {
    const response = await supabase.functions.invoke('track-cart-session', {
      body: cartData
    });

    if (response.error) {
      throw response.error;
    }

    return response.data;
  } catch (error) {
    console.error('Error tracking cart session:', error);
    throw error;
  }
};

export const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} mins ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return '1 day ago';
  }

  return `${diffInDays} days ago`;
};
