import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderWithItems } from '@/api/orders';

interface PendingOrderStats {
  total: number;
  needsAttention: number;
  awaitingPayment: number;
  processingTime: number;
}

export const usePendingOrdersLogic = () => {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const queryClient = useQueryClient();

  // Fetch pending orders statistics
  const { data: pendingStats, isLoading: statsLoading } = useQuery({
    queryKey: ['pending-orders-stats'],
    queryFn: async (): Promise<PendingOrderStats> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, created_at, payment_status, status, payment_reference')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const needsAttention = orders.filter(order => 
        new Date(order.created_at) < oneHourAgo && 
        !order.payment_reference
      ).length;

      const awaitingPayment = orders.filter(order => 
        order.payment_reference && order.payment_status === 'pending'
      ).length;

      const avgProcessingTime = orders.length > 0 
        ? orders.reduce((acc, order) => {
            const orderAge = now.getTime() - new Date(order.created_at).getTime();
            return acc + orderAge;
          }, 0) / orders.length / (1000 * 60) // Convert to minutes
        : 0;

      return {
        total: orders.length,
        needsAttention,
        awaitingPayment,
        processingTime: Math.round(avgProcessingTime)
      };
    },
    refetchInterval: autoRefreshEnabled ? 30000 : false, // Refresh every 30 seconds
    staleTime: 15000
  });

  // Fetch detailed pending orders
  const { data: pendingOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['pending-orders-detailed'],
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*),
          delivery_zones(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as OrderWithItems[];
    },
    refetchInterval: autoRefreshEnabled ? 30000 : false,
    staleTime: 15000
  });

  // Auto-resolve pending orders that have been paid
  const resolvePaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      return orderId;
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['pending-orders-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order status updated to confirmed');
    },
    onError: (error) => {
      toast.error(`Failed to update order: ${error.message}`);
    }
  });

  // Bulk process pending orders
  const bulkProcessMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .in('id', orderIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-orders-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders-detailed'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`${data.length} orders processed successfully`);
    },
    onError: (error) => {
      toast.error(`Bulk processing failed: ${error.message}`);
    }
  });

  // Mark order as needs attention
  const markNeedsAttentionMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Add to audit logs for tracking
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          action: 'pending_order_flagged',
          category: 'Order Management',
          message: 'Order marked as needing attention',
          entity_id: orderId
        });

      if (error) throw error;
      return orderId;
    },
    onSuccess: () => {
      toast.success('Order flagged for manual review');
    }
  });

  // Get orders that need immediate attention (over 1 hour old, no payment reference)
  const criticalOrders = pendingOrders.filter(order => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(order.created_at) < oneHourAgo && !order.payment_reference;
  });

  // Get orders awaiting payment verification
  const paymentPendingOrders = pendingOrders.filter(order => 
    order.payment_reference && order.payment_status === 'pending'
  );

  return {
    // Data
    pendingStats,
    pendingOrders,
    criticalOrders,
    paymentPendingOrders,
    
    // Loading states
    statsLoading,
    ordersLoading,
    
    // Mutations
    resolvePaymentMutation,
    bulkProcessMutation,
    markNeedsAttentionMutation,
    
    // Controls
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    
    // Computed values
    isProcessing: resolvePaymentMutation.isPending || 
                  bulkProcessMutation.isPending || 
                  markNeedsAttentionMutation.isPending
  };
};