import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderStatus } from '@/types/orders';

interface SimpleUpdateRequest {
  orderId: string;
  newStatus: OrderStatus;
  adminUserId: string;
}

export const useSimpleOrderStatusUpdate = () => {
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get current admin user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        setAdminUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const updateMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, adminUserId }: SimpleUpdateRequest) => {
      const { data, error } = await supabase.functions.invoke('order-manager', {
        body: {
          action: 'update_status',
          order_id: orderId,
          new_status: newStatus,
          admin_user_id: adminUserId
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Update failed');
      
      return data;
    },
    onSuccess: (data, variables) => {
      // Show success message
      toast.success(`Order status updated to ${variables.newStatus}`);

      // Invalidate relevant queries  
      queryClient.invalidateQueries({ queryKey: ['orders-new'] });
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId] });
    },
    onError: (error: any, variables) => {
      console.error('❌ Order status update failed:', error);
      
      const errorMessage = error?.message || 'Unknown error occurred';
      
      // Show error message
      toast.error(`Failed to update order: ${errorMessage}`);
    }
  });

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus): Promise<any> => {
    if (!adminUserId) {
      throw new Error('Admin user not authenticated');
    }

    return updateMutation.mutateAsync({
      orderId,
      newStatus,
      adminUserId
    });
  }, [updateMutation, adminUserId]);

  return {
    updateOrderStatus,
    isUpdating: updateMutation.isPending,
    error: updateMutation.error,
    adminUserId
  };
};