
import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';
import { supabase } from '@/integrations/supabase/client';

export const useCustomerOrders = () => {
  const { isAuthenticated, customerAccount, user } = useCustomerAuth();

  return useQuery({
    queryKey: ['customer-orders', customerAccount?.id, user?.email],
    queryFn: async () => {
      // First, get the user's email for order lookup
      const userEmail = user?.email || customerAccount?.email;
      if (!userEmail) {
        console.log('🔍 No user email found for order lookup');
        return { orders: [], count: 0 };
      }
      
      try {
        console.log('🔍 Fetching orders for customer:', customerAccount?.id, userEmail);
        
        // Primary strategy: Look up orders by the authenticated user's email
        // This handles both new customer_accounts orders and legacy guest orders
        let allOrders: any[] = [];
        
        // Approach 1: Get orders by authenticated user's email (most reliable)
        const { data: emailOrders, error: emailError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              product_id,
              product_name,
              quantity,
              unit_price
            )
          `)
          .eq('customer_email', userEmail)
          .order('order_time', { ascending: false });

        if (emailError) {
          console.error('Error in email orders query:', emailError);
        } else {
          console.log('🔍 Email-based orders found:', emailOrders?.length || 0);
          allOrders.push(...(emailOrders || []));
        }

        // Approach 2: If customer account exists, also try direct customer_id match
        if (customerAccount?.id) {
          const { data: directOrders, error: directError } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (
                id,
                product_id,
                product_name,
                quantity,
                unit_price
              )
            `)
            .eq('customer_id', customerAccount.id)
            .order('order_time', { ascending: false });

          if (directError) {
            console.error('Error in direct orders query:', directError);
          } else {
            console.log('🔍 Direct customer_id orders found:', directOrders?.length || 0);
            // Only add orders not already found by email to avoid duplicates
            const newOrders = directOrders?.filter(order => 
              !allOrders.some(existing => existing.id === order.id)
            ) || [];
            allOrders.push(...newOrders);
          }
        }

        console.log(`✅ Total orders found: ${allOrders.length} for customer account ID: ${customerAccount?.id} or email: ${userEmail}`);
        
        return {
          orders: allOrders,
          count: allOrders.length
        };
      } catch (error) {
        console.error('Error fetching orders:', error);
        return { orders: [], count: 0 };
      }
    },
    enabled: isAuthenticated && !!(user?.email || customerAccount?.email),
    // Always refetch on mount and focus to avoid stale pending states
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Keep data fresh; payments may settle within seconds
    staleTime: 10 * 1000,
    // Poll only while there are pending payments
    refetchInterval: (data) => {
      const list = Array.isArray((data as any)?.orders) ? (data as any).orders : [];
      const hasPending = list.some((o: any) => (o?.payment_status || '').toLowerCase() !== 'paid');
      return hasPending ? 30 * 1000 : false;
    },
    retry: 2,
    retryDelay: 1000,
  });
};
