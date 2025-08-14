
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useCustomerAuth } from './useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';

export const useCustomerOrders = () => {
  const { isAuthenticated, customerAccount, user } = useCustomerAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const query = useQuery({
    queryKey: ['customer-orders', customerAccount?.id, user?.email],
    queryFn: async ({ signal }) => {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;
      
      const userEmail = user?.email || customerAccount?.email;
      if (!userEmail) {
        console.log('🔍 No user email found for order lookup');
        return { orders: [], count: 0 };
      }
      
      try {
        console.log('🔍 Fetching orders for customer:', customerAccount?.id, userEmail);
        
        if (signal?.aborted || abortSignal.aborted) {
          throw new Error('Query aborted');
        }

        let allOrders: any[] = [];
        
        // Approach 1: Get orders by email (safer join without !inner)
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
              total_price
            )
          `)
          .eq('customer_email', userEmail)
          .order('order_time', { ascending: false });

        if (signal?.aborted || abortSignal.aborted) {
          throw new Error('Query aborted');
        }

        if (emailError) {
          console.error('❌ Error in email orders query:', emailError);
          // Don't throw, try fallback approach
        } else {
          console.log('✅ Email-based orders found:', emailOrders?.length || 0);
          allOrders.push(...(emailOrders || []));
        }

        // Approach 2: If customer account exists, also try direct customer_id match
        if (customerAccount?.id && !abortSignal.aborted) {
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
                total_price
              )
            `)
            .eq('customer_id', customerAccount.id)
            .order('order_time', { ascending: false });

          if (directError) {
            console.error('❌ Error in direct orders query:', directError);
          } else {
            console.log('✅ Direct customer_id orders found:', directOrders?.length || 0);
            // Only add orders not already found by email to avoid duplicates
            const newOrders = directOrders?.filter(order => 
              !allOrders.some(existing => existing.id === order.id)
            ) || [];
            allOrders.push(...newOrders);
          }
        }

        if (signal?.aborted || abortSignal.aborted) {
          throw new Error('Query aborted');
        }

        // Process orders to handle missing data gracefully
        const processedOrders = allOrders.map(order => ({
          ...order,
          order_items: (order.order_items || []).map((item: any) => ({
            ...item,
            product_name: item.product_name || 'Unknown Product',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_price: item.total_price || (item.quantity * item.unit_price) || 0
          }))
        }));

        console.log(`✅ Total orders processed: ${processedOrders.length} for customer: ${userEmail}`);
        
        return {
          orders: processedOrders,
          count: processedOrders.length
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'Query aborted') {
          console.log('🔄 Order query aborted - component unmounted');
          throw error;
        }
        console.error('❌ Critical error fetching orders:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch orders');
      }
    },
    enabled: isAuthenticated && !!(user?.email || customerAccount?.email),
    staleTime: 5 * 60 * 1000, // 5 minutes for production stability
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: (data) => {
      if (!isMountedRef.current) return false;
      const list = Array.isArray((data as any)?.orders) ? (data as any).orders : [];
      const hasPending = list.some((o: any) => (o?.payment_status || '').toLowerCase() !== 'paid');
      return hasPending ? 60 * 1000 : false; // Check every minute for pending orders
    },
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'Query aborted') return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Realtime subscription with proper cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isAuthenticated) return;
    
    const userEmail = user?.email || customerAccount?.email;
    const custId = customerAccount?.id;
    if (!userEmail && !custId) return;

    const filter = custId ? `customer_id=eq.${custId}` : `customer_email=eq.${userEmail}`;
    const channelName = `orders-${custId || userEmail}`;

    console.log('📡 Setting up realtime subscription for orders:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, (payload) => {
        if (!isMountedRef.current) return;
        
        try {
          console.log('📦 Order update received:', payload);
          query.refetch();
          
          const oldStatus = (payload as any)?.old?.payment_status?.toLowerCase?.();
          const newStatus = (payload as any)?.new?.payment_status?.toLowerCase?.();
          if (oldStatus !== 'paid' && newStatus === 'paid') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('payment-confirmed', {
                detail: { orderId: (payload as any)?.new?.id, orderReference: (payload as any)?.new?.payment_reference }
              }));
            }
          }
        } catch (error) {
          console.error('❌ Error handling realtime update:', error);
        }
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      supabase.removeChannel(channel);
      console.log('🔌 Cleaned up realtime subscription:', channelName);
    };
  }, [isAuthenticated, customerAccount?.id, user?.email, query.refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return query;
};
