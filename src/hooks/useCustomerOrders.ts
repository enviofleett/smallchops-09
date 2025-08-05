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
        
        if (!customerAccount?.id) {
          console.log('🔍 No customer account ID found');
          return { orders: [], count: 0 };
        }

        // Try multiple approaches to find orders for this customer:
        // 1. Direct customer_id match with customer_accounts
        // 2. Email match (fallback for legacy data)
        // 3. Check if customer_id in orders refers to legacy customers table
        
        let allOrders: any[] = [];
        
        // Approach 1: Try customer_id = customer_accounts.id
        const { data: directOrders, error: directError } = await supabase
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

        if (directError) {
          console.error('Error in direct orders query:', directError);
        } else {
          console.log('🔍 Direct orders found:', directOrders?.length || 0);
          allOrders.push(...(directOrders || []));
        }

        // Approach 2: Try email match if we have customer email and no direct orders found
        if (allOrders.length === 0 && customerAccount.email) {
          const { data: emailOrders, error: emailError } = await supabase
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

          if (emailError) {
            console.error('Error in email orders query:', emailError);
          } else {
            console.log('🔍 Email-based orders found:', emailOrders?.length || 0);
            allOrders.push(...(emailOrders || []));
          }
        }

        console.log('🔍 Total orders found:', allOrders.length);
        
        return {
          orders: allOrders,
          count: allOrders.length
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