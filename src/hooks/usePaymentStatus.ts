import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentStatus {
  isPaid: boolean;
  paidAt: string | null;
  paymentMethod: string | null;
  source: 'order' | 'transaction' | 'reconciled' | 'loading';
  lastUpdated: string;
  needsReconciliation: boolean;
  orderStatus: string;
}

interface PaymentStatusOptions {
  autoReconcile?: boolean;
  pollInterval?: number; // in milliseconds
  enableRealtime?: boolean;
}

export const usePaymentStatus = (
  orderId: string | null,
  options: PaymentStatusOptions = {}
) => {
  const {
    autoReconcile = true,
    pollInterval = 30000,
    enableRealtime = true,
  } = options;

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    isPaid: false,
    paidAt: null,
    paymentMethod: null,
    source: 'loading',
    lastUpdated: new Date().toISOString(),
    needsReconciliation: false,
    orderStatus: 'pending',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolvePaymentStatus = useCallback(
    async (orderIdToResolve: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Use the optimized RPC function with the new public view
        const { data: statusData, error: statusError } = await supabase
          .rpc('get_order_payment_status', { p_order_id: orderIdToResolve });

        if (statusError) {
          console.error('RPC get_order_payment_status failed:', statusError);
          // Fallback to the new public orders_with_payment view
          return await fallbackPaymentStatusQuery(orderIdToResolve);
        }

        const status: any = Array.isArray(statusData) ? statusData[0] : statusData;

        if (status) {
          setPaymentStatus({
            isPaid: status.final_paid || false,
            paidAt: status.final_paid_at,
            paymentMethod: status.payment_method || 'unknown',
            source: status.needs_reconciliation ? 'transaction' : 'order',
            lastUpdated: new Date().toISOString(),
            needsReconciliation: status.needs_reconciliation || false,
            orderStatus: status.order_status || 'pending',
          });

          // Auto-reconcile if needed and enabled
          if (autoReconcile && status.needs_reconciliation) {
            try {
              const { error: reconcileError } = await supabase.functions.invoke(
                'payment-reconcile',
                {
                  body: {
                    action: 'reconcile_order',
                    order_id: orderIdToResolve,
                  },
                }
              );

              if (!reconcileError) {
                // Refresh status after reconciliation
                setTimeout(() => resolvePaymentStatus(orderIdToResolve), 2000);
              }
            } catch (reconcileError) {
              console.warn('Auto-reconciliation failed:', reconcileError);
            }
          }
        } else {
          // Order not found or no status available
          setPaymentStatus({
            isPaid: false,
            paidAt: null,
            paymentMethod: null,
            source: 'order',
            lastUpdated: new Date().toISOString(),
            needsReconciliation: false,
            orderStatus: 'pending',
          });
        }
      } catch (err) {
        console.error('Payment status resolution error:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to resolve payment status'
        );

        // Try fallback query
        await fallbackPaymentStatusQuery(orderIdToResolve);
      } finally {
        setIsLoading(false);
      }
    },
    [autoReconcile]
  );

  const fallbackPaymentStatusQuery = useCallback(async (orderIdToResolve: string) => {
    try {
      // Try the new public orders_with_payment view first
      const { data: orderWithPayment, error: viewError } = await supabase
        .from('orders_with_payment')
        .select(`
          id,
          payment_status,
          paid_at,
          status,
          computed_payment_status,
          payment_reference,
          transaction_status,
          transaction_amount
        `)
        .eq('id', orderIdToResolve)
        .maybeSingle();

      let order = orderWithPayment;
      
      if (viewError || !orderWithPayment) {
        console.warn('orders_with_payment view failed, using direct orders table:', viewError);
        // Fallback to direct orders table
        const { data: directOrder, error: orderError } = await supabase
          .from('orders')
          .select('id, payment_status, paid_at, status')
          .eq('id', orderIdToResolve)
          .maybeSingle();

        if (orderError) throw orderError;
        // Ensure fallback order has all required fields for type checking
        order = directOrder ? {
          ...directOrder,
          computed_payment_status: directOrder.payment_status === 'paid' ? 'paid' : 'pending',
          payment_reference: null,
          transaction_status: null,
          transaction_amount: null
        } : null;
      }

      // Transactions table (latest first)
      const { data: transactions, error: txError } = await supabase
        .from('payment_transactions')
        .select('status, paid_at, channel, provider_reference, created_at')
        .eq('order_id', orderIdToResolve)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Use computed payment status if available from the view
      if (order && 'computed_payment_status' in order) {
        const needsReconciliation = order.computed_payment_status === 'processing' || 
                                  (order.payment_status !== 'paid' && order.transaction_status === 'success');
        
        setPaymentStatus({
          isPaid: order.computed_payment_status === 'paid',
          paidAt: order.paid_at,
          paymentMethod: order.computed_payment_status === 'paid' ? 'processed' : null,
          source: 'order',
          lastUpdated: new Date().toISOString(),
          needsReconciliation,
          orderStatus: order.status || 'pending',
        });
      } else {
        // Fallback to transaction checking logic
        const successfulTx = transactions?.find(
          (tx) => tx.status === 'success' || tx.status === 'paid'
        );

        const needsReconciliation = order?.payment_status !== 'paid' && !!successfulTx;

        setPaymentStatus({
          isPaid: order?.payment_status === 'paid' || !!successfulTx,
          paidAt: order?.paid_at || successfulTx?.paid_at || null,
          paymentMethod:
            successfulTx?.channel || (order?.payment_status === 'paid' ? 'processed' : null),
          source: needsReconciliation ? 'transaction' : 'order',
          lastUpdated: new Date().toISOString(),
          needsReconciliation,
          orderStatus: order?.status || 'pending',
        });
      }
    } catch (fallbackError) {
      console.error('Fallback query failed:', fallbackError);
      setError('Unable to determine payment status');

      setPaymentStatus({
        isPaid: false,
        paidAt: null,
        paymentMethod: null,
        source: 'order',
        lastUpdated: new Date().toISOString(),
        needsReconciliation: false,
        orderStatus: 'pending',
      });
    }
  }, []);

  const refreshPaymentStatus = useCallback(() => {
    if (orderId) {
      resolvePaymentStatus(orderId);
    }
  }, [orderId, resolvePaymentStatus]);

  const manualReconcile = useCallback(async () => {
    if (!orderId) return false;

    try {
      const { error } = await supabase.functions.invoke('payment-reconcile', {
        body: {
          action: 'reconcile_order',
          order_id: orderId,
        },
      });

      if (error) throw error;

      await resolvePaymentStatus(orderId);
      return true;
    } catch (err) {
      console.error('Manual reconciliation failed:', err);
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
      return false;
    }
  }, [orderId, resolvePaymentStatus]);

  // Initial load
  useEffect(() => {
    if (orderId) {
      resolvePaymentStatus(orderId);
    } else {
      setIsLoading(false);
    }
  }, [orderId, resolvePaymentStatus]);

  // Polling (only for unpaid)
  useEffect(() => {
    if (!orderId || !pollInterval || paymentStatus.isPaid) return;

    const interval = setInterval(() => {
      resolvePaymentStatus(orderId);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [orderId, pollInterval, paymentStatus.isPaid, resolvePaymentStatus]);

  // Realtime subscriptions
  useEffect(() => {
    if (!enableRealtime || !orderId) return;

    const channel = supabase
      .channel(`payment-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => refreshPaymentStatus()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_transactions', filter: `order_id=eq.${orderId}` },
        () => refreshPaymentStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, enableRealtime, refreshPaymentStatus]);

  return {
    paymentStatus,
    isLoading,
    error,
    refreshPaymentStatus,
    manualReconcile,
    // Convenience getters
    isPaid: paymentStatus.isPaid,
    paidAt: paymentStatus.paidAt,
    paymentMethod: paymentStatus.paymentMethod,
    needsReconciliation: paymentStatus.needsReconciliation,
    orderStatus: paymentStatus.orderStatus,
  };
};

// Hook for multiple orders (useful for admin dashboard)
export const useMultiplePaymentStatuses = (orderIds: string[] = []) => {
  const [statuses, setStatuses] = useState<Record<string, PaymentStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMultipleStatuses = useCallback(async () => {
    if (orderIds.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Query orders directly with payment information
      const { data: ordersWithPayment, error: viewError } = await supabase
        .from('orders')
        .select(`
          id,
          payment_status,
          paid_at,
          status,
          final_paid,
          final_paid_at,
          payment_channel,
          payment_method,
          payment_tx_status,
          needs_reconciliation
        `)
        .in('id', orderIds);

      let ordersData: any[] | null = ordersWithPayment;

      if (viewError || !ordersWithPayment) {
        console.warn('orders_with_payment view not accessible, using fallback');
        const { data: fallbackOrders, error: fallbackError } = await supabase
          .from('orders')
          .select('id, payment_status, paid_at, status')
          .in('id', orderIds);
        if (fallbackError) throw fallbackError;
        ordersData = fallbackOrders;
      }

      const newStatuses: Record<string, PaymentStatus> = {};

      for (const order of ordersData || []) {
        if ('final_paid' in order) {
          newStatuses[order.id] = {
            isPaid: order.final_paid || false,
            paidAt: order.final_paid_at,
            paymentMethod: order.payment_method || order.payment_channel,
            source: 'order',
            lastUpdated: new Date().toISOString(),
            needsReconciliation: order.needs_reconciliation || false,
            orderStatus: order.status || 'pending',
          };
        } else {
          const needsTransactionCheck = order.payment_status !== 'paid';
          if (needsTransactionCheck) {
            try {
              const { data: transactions } = await supabase
                .from('payment_transactions')
                .select('status, paid_at, channel')
                .eq('order_id', order.id)
                .order('created_at', { ascending: false })
                .limit(1);

              const successfulTx = transactions?.find(
                (tx) => tx.status === 'success' || tx.status === 'paid'
              );

              newStatuses[order.id] = {
                isPaid: order.payment_status === 'paid' || !!successfulTx,
                paidAt: order.paid_at || successfulTx?.paid_at || null,
                paymentMethod:
                  successfulTx?.channel || (order.payment_status === 'paid' ? 'processed' : null),
                source: 'order',
                lastUpdated: new Date().toISOString(),
                needsReconciliation: !!successfulTx && order.payment_status !== 'paid',
                orderStatus: order.status || 'pending',
              };
            } catch (txError) {
              console.error('Error checking transactions for order', order.id, txError);
              newStatuses[order.id] = {
                isPaid: order.payment_status === 'paid',
                paidAt: order.paid_at,
                paymentMethod: order.payment_status === 'paid' ? 'processed' : null,
                source: 'order',
                lastUpdated: new Date().toISOString(),
                needsReconciliation: false,
                orderStatus: order.status || 'pending',
              };
            }
          } else {
            newStatuses[order.id] = {
              isPaid: true,
              paidAt: order.paid_at,
              paymentMethod: 'processed',
              source: 'order',
              lastUpdated: new Date().toISOString(),
              needsReconciliation: false,
              orderStatus: order.status || 'pending',
            };
          }
        }
      }

      // Ensure all provided orderIds have an entry
      orderIds.forEach((id) => {
        if (!newStatuses[id]) {
          newStatuses[id] = {
            isPaid: false,
            paidAt: null,
            paymentMethod: null,
            source: 'order',
            lastUpdated: new Date().toISOString(),
            needsReconciliation: false,
            orderStatus: 'pending',
          };
        }
      });

      setStatuses(newStatuses);
    } catch (err) {
      console.error('Multiple payment status load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment statuses');
    } finally {
      setIsLoading(false);
    }
  }, [orderIds]);

  useEffect(() => {
    loadMultipleStatuses();
  }, [loadMultipleStatuses]);

  const reconcileAll = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('payment-reconcile', {
        body: { action: 'reconcile_all' },
      });

      if (error) throw error;
      await loadMultipleStatuses();
      return true;
    } catch (err) {
      console.error('Bulk reconciliation failed:', err);
      setError(err instanceof Error ? err.message : 'Bulk reconciliation failed');
      return false;
    }
  }, [loadMultipleStatuses]);

  return {
    statuses,
    isLoading,
    error,
    refreshAll: loadMultipleStatuses,
    reconcileAll,
    getStatusFor: (orderId: string) => statuses[orderId],
    getPaidOrders: () => Object.entries(statuses).filter(([_, s]) => s.isPaid),
    getUnpaidOrders: () => Object.entries(statuses).filter(([_, s]) => !s.isPaid),
    getNeedsReconciliation: () =>
      Object.entries(statuses).filter(([_, s]) => s.needsReconciliation),
  };
};

// Hook for system health monitoring (admin only)
export const usePaymentSystemHealth = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: healthError } = await supabase.functions.invoke(
        'payment-reconcile',
        { body: { action: 'check_health' } }
      );

      if (healthError) throw healthError;
      setHealthData((data as any)?.data);
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    healthData,
    isLoading,
    error,
    refreshHealth: checkHealth,
    needsAttention: (healthData as any)?.summary?.needs_attention || false,
    inconsistentOrders: (healthData as any)?.inconsistent_orders?.value || 0,
    pendingEmails: (healthData as any)?.pending_emails?.value || 0,
  };
};
