import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number?: string;
  customer_email: string;
  created_at: string;
  order_time?: string;
  status: string;
  payment_status?: string;
  total_amount?: number;
  order_items?: OrderItem[];
}

interface OrdersData {
  orders: Order[];
  count: number;
}

export const useCustomerOrdersOptimized = () => {
  const { isAuthenticated, user } = useCustomerAuth();

  return useQuery<OrdersData>({
    queryKey: ['customer-orders-optimized', user?.email],
    queryFn: async (): Promise<OrdersData> => {
      const userEmail = user?.email;
      
      if (!userEmail || !isAuthenticated) {
        console.log('No authentication - returning empty orders');
        return { orders: [], count: 0 };
      }

      console.log('🔍 Fetching orders for:', userEmail);

      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            customer_email,
            created_at,
            order_time,
            status,
            payment_status,
            total_amount,
            order_items (
              id,
              product_name,
              quantity,
              unit_price,
              total_price
            )
          `)
          .eq('customer_email', userEmail.toLowerCase())
          .order('order_time', { ascending: false });

        if (error) {
          console.error('❌ Orders query error:', error);
          
          // Handle specific error types
          if (error.code === '42501') {
            throw new Error('Access denied. Please refresh and try again.');
          }
          if (error.code === 'PGRST116') {
            throw new Error('Authentication error. Please sign out and sign back in.');
          }
          if (error.message.includes('JWT')) {
            throw new Error('Session expired. Please refresh the page.');
          }
          
          throw new Error(`Database error: ${error.message}`);
        }

        const processedOrders = (orders || []).map(order => ({
          ...order,
          order_items: (order.order_items || []).map((item: any) => ({
            ...item,
            product_name: item.product_name || 'Unknown Product',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_price: item.total_price || (item.quantity * item.unit_price) || 0
          }))
        }));

        console.log('✅ Orders loaded successfully:', processedOrders.length);
        
        return {
          orders: processedOrders,
          count: processedOrders.length
        };
      } catch (error) {
        console.error('❌ Error fetching orders:', error);
        
        if (error instanceof Error) {
          throw error;
        }
        
        throw new Error('Unable to load orders. Please try again.');
      }
    },
    enabled: isAuthenticated && !!user?.email,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && 
          (error.message.includes('permission') || 
           error.message.includes('Access denied'))) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000)
  });
};