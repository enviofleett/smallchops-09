import { useState, useCallback } from 'react';
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

  const updateStatus = useCallback(async (newStatus: OrderStatus, notes?: string): Promise<boolean> => {
    if (!orderId) {
      toast.error('Invalid order ID');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // First try the bulletproof admin function
      const { data: result, error: rpcError } = await supabase
        .rpc('admin_update_order_status_bulletproof', {
          p_order_id: orderId,
          p_new_status: newStatus,
          p_admin_id: (await supabase.auth.getUser()).data.user?.id || null,
        });

      if (rpcError) {
        throw rpcError;
      }

      if (!(result as any)?.success) {
        throw new Error((result as any)?.error || 'Failed to update order status');
      }

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
  }, [orderId]);

  return {
    updateStatus,
    isUpdating,
    error,
  };
};