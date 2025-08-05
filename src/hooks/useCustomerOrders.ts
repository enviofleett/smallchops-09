import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';
import { supabase } from '@/integrations/supabase/client';

export const useCustomerOrders = () => {
  const { isAuthenticated, customerAccount } = useCustomerAuth();

  return useQuery({
    queryKey: ['customer-orders', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount?.id) {
        return { orders: [], count: 0 };
      }
      
      try {
        console.log('🔍 Fetching orders for customer:', customerAccount?.id, customerAccount?.email);
        
        // First try to get orders by customer_id
        const { data: ordersData, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              product_id,
              product_name,
              quantity,
              price_per_item,
              products (
                name,
                image_url
              )
            )
          `)
          .eq('customer_id', customerAccount.id)
          .order('order_time', { ascending: false });

        if (error) {
          console.error('Error fetching orders by customer_id:', error);
          return { orders: [], count: 0 };
        }
        
        console.log('🔍 Orders by customer_id:', ordersData?.length || 0);

        // If no orders found by customer_id, try customer_email fallback
        let finalOrders = ordersData || [];
        if (!finalOrders.length && customerAccount.email) {
          const { data: emailOrders } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (
                id,
                product_id,
                product_name,
                quantity,
                price_per_item,
                products (
                  name,
                  image_url
                )
              )
            `)
            .eq('customer_email', customerAccount.email)
            .order('order_time', { ascending: false });
          
          finalOrders = emailOrders || [];
        }
        
        return {
          orders: finalOrders,
          count: finalOrders.length
        };
      } catch (error) {
        console.error('Error fetching orders:', error);
        return { orders: [], count: 0 };
      }
    },
    enabled: isAuthenticated && !!customerAccount?.id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });
};