
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
        
        // Simplified orders fetch with enhanced RLS error handling
        const { data: orders, error: ordersError } = await supabase
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

        if (ordersError) {
          console.error('❌ Orders query error:', {
            error: ordersError,
            code: ordersError.code,
            message: ordersError.message,
            hint: ordersError.hint,
            userEmail,
            timestamp: new Date().toISOString()
          });
          
          // Handle specific RLS and authentication errors
          if (ordersError.code === '42501') {
            throw new Error(`Access denied for ${userEmail}. Please refresh and try again.`);
          }
          
          if (ordersError.code === 'PGRST116') {
            throw new Error(`Authentication error for ${userEmail}. Please sign out and sign back in.`);
          }
          
          if (ordersError.message.includes('JWT')) {
            throw new Error(`Session expired for ${userEmail}. Please refresh the page.`);
          }
          
          throw new Error(`Database error: ${ordersError.message}`);
        }

        allOrders = orders || [];
        hasEmailOrders = (orders?.length || 0) > 0;
        console.log('✅ Orders loaded successfully:', {
          count: allOrders.length,
          userEmail,
          timestamp: new Date().toISOString()
        });

        // Remove the duplicate customer_id query approach - the new RLS policy handles this automatically

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
        
        // Enhanced error context for production debugging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const context = {
          customerEmail: userEmail,
          customerId: customerAccount?.id,
          isAuthenticated,
          timestamp: new Date().toISOString(),
          errorCode: (error as any)?.code || 'unknown'
        };
        
        console.error('🚨 Critical order loading error:', {
          error,
          context,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // User-friendly error messages based on error type
        if (errorMessage.includes('permission') || errorMessage.includes('policy') || errorMessage.includes('42501')) {
          throw new Error(`Access denied. Please sign out and sign back in to refresh your permissions.`);
        }
        
        if (errorMessage.includes('PGRST') || errorMessage.includes('connection')) {
          throw new Error(`Connection issue. Please check your internet and try again.`);
        }
        
        if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
          throw new Error(`Session expired. Please refresh the page to continue.`);
        }
        
        throw new Error(`Unable to load orders. Please try again or contact support if the issue persists.`);
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
          // Delayed refetch to prevent subscription conflicts
          setTimeout(() => {
            if (isMountedRef.current) {
              query.refetch();
            }
          }, 100);
          
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
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        // Handle subscription status changes without type checking
        if (String(status).includes('ERROR')) {
          console.error('❌ Real-time subscription failed - continuing without real-time updates');
        } else if (String(status).includes('SUBSCRIBED')) {
          console.log('✅ Real-time subscription active');
        }
      });

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
