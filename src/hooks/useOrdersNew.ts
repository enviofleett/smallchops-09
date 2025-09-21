import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderFilters {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface OrderUpdateRequest {
  order_id: string;
  new_status: string;
  admin_id: string;
  admin_name?: string;
  version?: number;
}

interface ConflictInfo {
  current_version: number;
  current_status: string;
  last_updated_by: string;
  last_updated_at: string;
}

interface OrderUpdateResult {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  conflict?: ConflictInfo;
}

// Data fetching hook
export const useOrdersNew = (filters: OrderFilters = {}) => {
  return useQuery({
    queryKey: ['orders-new', filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('order-manager', {
        body: {
          action: 'list_orders',
          admin_id: 'current-user', // Will be validated by edge function
          page: filters.page || 1,
          page_size: filters.pageSize || 20,
          status_filter: filters.status || 'all',
          search_query: filters.search || ''
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true
  });
};

// Order status update hook with conflict resolution
export const useOrderUpdate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (request: OrderUpdateRequest): Promise<OrderUpdateResult> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('order-manager', {
        body: {
          action: 'update_status',
          order_id: request.order_id,
          new_status: request.new_status,
          admin_id: user.id,
          admin_name: request.admin_name || 'Admin',
          version: request.version
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch orders
        queryClient.invalidateQueries({ queryKey: ['orders-new'] });
        
        toast({
          title: "Order Updated",
          description: `Order status changed to ${variables.new_status}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};

// Real-time updates hook
export const useOrdersRealTime = () => {
  const queryClient = useQueryClient();

  return {
    subscribe: () => {
      const channel = supabase
        .channel('orders-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders_new'
          },
          (payload) => {
            console.log('Real-time order update:', payload);
            
            // Invalidate queries to refetch data
            queryClient.invalidateQueries({ queryKey: ['orders-new'] });
            
            // Show toast for updates from other admins
            if (payload.eventType === 'UPDATE' && payload.new) {
              const order = payload.new;
              if (order.updated_by_name) {
                queryClient.getQueryClient()?.getQueryCache().notify({
                  type: 'added',
                  query: queryClient.getQueryCache().find({ queryKey: ['orders-new'] }),
                });
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  };
};

// Get order details
export const useOrderDetails = (orderId: string) => {
  return useQuery({
    queryKey: ['order-details', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders_new')
        .select(`
          *,
          order_items_new(*),
          order_delivery_schedule(*),
          order_audit(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId
  });
};

// Assign rider mutation
export const useAssignRider = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orderId, riderId, riderName }: { orderId: string; riderId: string; riderName: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('order-manager', {
        body: {
          action: 'assign_rider',
          order_id: orderId,
          rider_id: riderId,
          rider_name: riderName,
          admin_id: user.id
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-new'] });
      toast({
        title: "Rider Assigned",
        description: "Delivery rider has been assigned successfully",
      });
    }
  });
};