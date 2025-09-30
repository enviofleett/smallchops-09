import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderStatus } from '@/types/orders';

interface StatusUpdateParams {
  orderId: string;
  status: OrderStatus;
}

/**
 * Simple, lightweight order status update hook - bypasses complex pipeline
 * Implements optimistic updates, forced refetch, and error rollback
 */
export const useSimpleStatusUpdate = () => {
  const queryClient = useQueryClient();

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: StatusUpdateParams) => {
      // Direct Supabase update - no edge functions
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    // Optimistic update: Update UI immediately before server responds
    onMutate: async (variables) => {
      const { orderId, status } = variables;

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['admin-orders'] });
      await queryClient.cancelQueries({ queryKey: ['unified-orders'] });
      await queryClient.cancelQueries({ queryKey: ['detailed-order', orderId] });

      // Snapshot the previous values for rollback
      const previousAdminOrders = queryClient.getQueryData(['admin-orders']);
      const previousUnifiedOrders = queryClient.getQueryData(['unified-orders']);
      const previousDetailedOrder = queryClient.getQueryData(['detailed-order', orderId]);

      // Optimistically update admin orders list
      queryClient.setQueryData(['admin-orders'], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((order: any) =>
              order.id === orderId
                ? { ...order, status, updated_at: new Date().toISOString() }
                : order
            )
          }))
        };
      });

      // Optimistically update unified orders list
      queryClient.setQueryData(['unified-orders'], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data?.map((order: any) =>
              order.id === orderId
                ? { ...order, status, updated_at: new Date().toISOString() }
                : order
            )
          }))
        };
      });

      // Optimistically update detailed order
      queryClient.setQueryData(['detailed-order', orderId], (old: any) => {
        if (!old) return old;
        return { ...old, status, updated_at: new Date().toISOString() };
      });

      // Return context with previous values for rollback
      return { previousAdminOrders, previousUnifiedOrders, previousDetailedOrder };
    },
    onSuccess: (data, variables) => {
      const statusLabel = variables.status.replace('_', ' ');
      toast.success(`Order status updated to ${statusLabel}`);
      
      // Forced refetch to ensure data consistency with server
      queryClient.refetchQueries({ queryKey: ['admin-orders'] });
      queryClient.refetchQueries({ queryKey: ['unified-orders'] });
      queryClient.refetchQueries({ queryKey: ['detailed-order', variables.orderId] });
    },
    onError: (error: any, variables, context: any) => {
      console.error('Simple status update failed:', error);
      toast.error(error.message || 'Failed to update order status');
      
      // Rollback: Restore previous state on error
      if (context?.previousAdminOrders !== undefined) {
        queryClient.setQueryData(['admin-orders'], context.previousAdminOrders);
      }
      if (context?.previousUnifiedOrders !== undefined) {
        queryClient.setQueryData(['unified-orders'], context.previousUnifiedOrders);
      }
      if (context?.previousDetailedOrder !== undefined) {
        queryClient.setQueryData(['detailed-order', variables.orderId], context.previousDetailedOrder);
      }
    }
  });

  return {
    updateStatus: statusUpdateMutation.mutate,
    isUpdating: statusUpdateMutation.isPending,
    error: statusUpdateMutation.error
  };
};