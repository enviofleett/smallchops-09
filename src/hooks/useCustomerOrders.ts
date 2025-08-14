
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
      // PRODUCTION FIX: Simplified abort controller to prevent conflicts
      const userEmail = user?.email || customerAccount?.email;
      
      console.log('🔍 Starting order query for:', { 
        customerEmail: userEmail, 
        customerId: customerAccount?.id,
        isAuthenticated 
      });
      
      if (!userEmail) {
        console.log('⚠️ No user email found for order lookup');
        return { orders: [], count: 0 };
      }
      
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, returning empty orders');
        return { orders: [], count: 0 };
      }
      
      try {
        console.log('🔍 Fetching orders for customer:', { 
          customerId: customerAccount?.id, 
          email: userEmail,
          timestamp: new Date().toISOString()
        });
        
        // PRODUCTION FIX: Minimal abort checking to prevent premature cancellation
        if (signal?.aborted) {
          console.log('🔄 Query aborted at start');
          throw new Error('Query aborted');
        }

        let allOrders: any[] = [];
        let hasEmailOrders = false;
        let hasCustomerIdOrders = false;
        
        // Approach 1: Get orders by email with comprehensive error handling
        try {
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
            .eq('customer_email', userEmail.toLowerCase())
            .order('order_time', { ascending: false });

          if (emailError) {
            console.error('❌ Email orders query error:', {
              error: emailError,
              code: emailError.code,
              message: emailError.message,
              hint: emailError.hint
            });
          } else {
            console.log('✅ Email-based orders found:', emailOrders?.length || 0);
            allOrders.push(...(emailOrders || []));
            hasEmailOrders = (emailOrders?.length || 0) > 0;
          }
        } catch (emailQueryError) {
          console.error('❌ Email orders query exception:', emailQueryError);
        }

        // Approach 2: If customer account exists, also try direct customer_id match
        if (customerAccount?.id) {
          try {
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
              console.error('❌ Customer ID orders query error:', {
                error: directError,
                customerId: customerAccount.id,
                code: directError.code,
                message: directError.message
              });
            } else {
              console.log('✅ Direct customer_id orders found:', directOrders?.length || 0);
              // Only add orders not already found by email to avoid duplicates
              const newOrders = directOrders?.filter(order => 
                !allOrders.some(existing => existing.id === order.id)
              ) || [];
              allOrders.push(...newOrders);
              hasCustomerIdOrders = (directOrders?.length || 0) > 0;
            }
          } catch (customerQueryError) {
            console.error('❌ Customer ID orders query exception:', customerQueryError);
          }
        }

        // PRODUCTION FIX: Remove redundant abort check - React Query handles this

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

        console.log(`✅ Orders processing complete:`, {
          totalOrders: processedOrders.length,
          customerEmail: userEmail,
          customerId: customerAccount?.id,
          hasEmailOrders,
          hasCustomerIdOrders,
          timestamp: new Date().toISOString()
        });
        
        return {
          orders: processedOrders,
          count: processedOrders.length,
          sources: {
            email: hasEmailOrders,
            customerId: hasCustomerIdOrders
          }
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'Query aborted') {
          console.log('🔄 Order query aborted - component unmounted or cancelled');
          throw error;
        }
        
        console.error('❌ Critical error fetching orders:', {
          error,
          customerEmail: userEmail,
          customerId: customerAccount?.id,
          isAuthenticated,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        
        // PRODUCTION FIX: Enhanced error context for debugging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const context = {
          customerEmail: userEmail,
          customerId: customerAccount?.id,
          isAuthenticated,
          timestamp: new Date().toISOString()
        };
        
        if (errorMessage.includes('permission') || errorMessage.includes('policy')) {
          throw new Error(`Authentication issue detected for ${userEmail}. Please refresh and try again. Context: ${JSON.stringify(context)}`);
        }
        
        if (errorMessage.includes('PGRST')) {
          throw new Error(`Database connection issue. Please try again in a moment. Context: ${JSON.stringify(context)}`);
        }
        
        throw new Error(`Unable to load orders for ${userEmail}: ${errorMessage}. Context: ${JSON.stringify(context)}`);
      }
    },
    enabled: isAuthenticated && !!(user?.email || customerAccount?.email),
    staleTime: 2 * 60 * 1000, // 2 minutes for faster updates in production
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: (data) => {
      if (!isMountedRef.current) return false;
      const list = Array.isArray((data as any)?.orders) ? (data as any).orders : [];
      const hasPending = list.some((o: any) => (o?.payment_status || '').toLowerCase() !== 'paid');
      return hasPending ? 30 * 1000 : false; // Check every 30 seconds for pending orders
    },
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'Query aborted') {
        console.log('🔄 Not retrying aborted query');
        return false;
      }
      
      const shouldRetry = failureCount < 3;
      console.log(`🔄 Order query retry decision:`, {
        failureCount,
        shouldRetry,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return shouldRetry;
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 5000); // Max 5 second delay
      console.log(`🔄 Retrying order query in ${delay}ms (attempt ${attemptIndex + 1})`);
      return delay;
    },
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
      console.log('🔌 Cleaning up useCustomerOrders hook');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return query;
};
