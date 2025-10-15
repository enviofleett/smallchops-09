import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderStatus, OrderStatusUpdatePayload } from '@/types/orderDetailsModal';
import { toast } from 'sonner';

interface UseUpdateOrderStatusReturn {
  updateStatus: (newStatus: OrderStatus, notes?: string) => Promise<boolean>;
  isUpdating: boolean;
  error: string | null;
}

export const useUpdateOrderStatus = (orderId: string): UseUpdateOrderStatusReturn => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateStatus = useCallback(async (newStatus: OrderStatus, notes?: string): Promise<boolean> => {
    if (!orderId) {
      toast.error('Invalid order ID');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // 🔒 SECURITY: Verify admin access before updating
      const { requireAdminAccess, checkClientRateLimit } = await import('@/lib/api-security');
      
      // Client-side rate limit
      if (!checkClientRateLimit('update-order-status', 10, 30000)) {
        throw new Error('Too many status updates. Please wait.');
      }

      // Verify admin access
      const auth = await requireAdminAccess();

      // Call bulletproof admin function with verified auth
      const { data: result, error: rpcError } = await supabase
        .rpc('admin_update_order_status_bulletproof', {
          p_order_id: orderId,
          p_new_status: newStatus,
          p_admin_id: auth.userId,
        });

      if (rpcError) {
        throw rpcError;
      }

      if (!(result as any)?.success) {
        throw new Error((result as any)?.error || 'Failed to update order status');
      }

      // Invalidate ALL relevant query keys to ensure UI updates across all tabs
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-orders-polling'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-list'] }),
        queryClient.invalidateQueries({ queryKey: ['unified-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['detailed-order', orderId] }),
      ]);
      
      // Force immediate refetch of real-time orders
      await queryClient.refetchQueries({ 
        queryKey: ['orders-list'],
        type: 'active'
      });

      toast.success('Order status updated successfully');
      return true;

    } catch (error: any) {
      console.error('Error updating order status:', error);
      const errorMessage = error.message || 'Failed to update order status';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;

    } finally {
      setIsUpdating(false);
    }
  }, [orderId, queryClient]);

  return {
    updateStatus,
    isUpdating,
    error,
  };
};
