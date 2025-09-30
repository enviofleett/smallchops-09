
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';
import { supabase } from '@/integrations/supabase/client';

export const useCustomerOrders = () => {
  const { isAuthenticated, customerAccount, user } = useCustomerAuth();

  const query = useQuery({
    queryKey: ['customer-orders', customerAccount?.id, user?.email],
    queryFn: async () => {
      // Get user's auth session for debugging
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 Order Query - Auth State:', {
        isAuthenticated,
        hasUser: !!user,
        hasCustomerAccount: !!customerAccount,
        userEmail: user?.email,
        customerEmail: customerAccount?.email,
        sessionUser: session?.user?.email,
        customerId: customerAccount?.id
      });

      // First, get the user's email for order lookup
      const userEmail = user?.email || customerAccount?.email || session?.user?.email;
      if (!userEmail) {
        console.error('❌ No user email found for order lookup');
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
              unit_price,
              total_price,
              vat_amount,
              discount_amount,
              customizations,
              special_instructions
            )
          `)
          .eq('customer_email', userEmail)
          .order('order_time', { ascending: false });

        if (emailError) {
          console.error('❌ Error in email orders query:', emailError);
          console.error('❌ Query details:', { userEmail, isAuthenticated });
        } else {
          console.log('✅ Email-based orders found:', emailOrders?.length || 0);
          if (emailOrders && emailOrders.length > 0) {
            console.log('✅ Sample order:', {
              orderNumber: emailOrders[0].order_number,
              status: emailOrders[0].status,
              paymentStatus: emailOrders[0].payment_status,
              totalAmount: emailOrders[0].total_amount,
              itemsCount: emailOrders[0].order_items?.length || 0
            });
          }
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
                unit_price,
                total_price,
                vat_amount,
                discount_amount,
                customizations,
                special_instructions
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

        console.log(`✅ TOTAL ORDERS FOUND: ${allOrders.length} for customer:`, {
          customerAccountId: customerAccount?.id,
          email: userEmail,
          orderIds: allOrders.map(o => o.order_number).slice(0, 5)
        });
        
        if (allOrders.length === 0) {
          console.warn('⚠️ No orders found! Debugging info:', {
            isAuthenticated,
            hasUser: !!user,
            hasCustomerAccount: !!customerAccount,
            userEmail,
            customerAccountId: customerAccount?.id
          });
        }
        
        return {
          orders: allOrders,
          count: allOrders.length
        };
      } catch (error) {
        console.error('❌ CRITICAL ERROR fetching orders:', error);
        console.error('❌ Error details:', {
          error,
          isAuthenticated,
          userEmail: user?.email,
          customerEmail: customerAccount?.email
        });
        return { orders: [], count: 0 };
      }
    },
    enabled: isAuthenticated && !!(user?.email || customerAccount?.email),
    // Balanced refetch strategy to reduce flickering
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // Longer stale time for better stability
    staleTime: 2 * 60 * 1000, // 2 minutes
    // Poll only while there are pending payments but less frequently
    refetchInterval: (data) => {
      const list = Array.isArray((data as any)?.orders) ? (data as any).orders : [];
      const hasPending = list.some((o: any) => (o?.payment_status || '').toLowerCase() !== 'paid');
      return hasPending ? 30 * 1000 : false; // 30 seconds instead of 10
    },
    retry: 1,
    retryDelay: 2000,
  });

  // Realtime: refresh on customer-specific orders changes
  useEffect(() => {
    if (!isAuthenticated) return;
    const userEmail = user?.email || customerAccount?.email;
    const custId = customerAccount?.id;
    if (!userEmail && !custId) return;

    const filter = custId ? `customer_id=eq.${custId}` : `customer_email=eq.${userEmail}`;
    const channelName = `orders-${custId || userEmail}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, (payload) => {
        try { (query as any)?.refetch?.(); } catch {}
        const oldStatus = (payload as any)?.old?.payment_status?.toLowerCase?.();
        const newStatus = (payload as any)?.new?.payment_status?.toLowerCase?.();
        if (oldStatus !== 'paid' && newStatus === 'paid') {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('payment-confirmed', {
              detail: { orderId: (payload as any)?.new?.id, orderReference: (payload as any)?.new?.payment_reference }
            }));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, customerAccount?.id, user?.email]);

  return query;
};
