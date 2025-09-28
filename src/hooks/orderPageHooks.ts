import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { updateOrder, getDispatchRiders, assignRiderToOrder, bulkUpdateOrders } from '@/api/orders';
import { sendOrderStatusEmailWithFallback } from '@/utils/sendOrderStatusEmail';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { useUpdateOrderStatus } from '@/hooks/useUpdateOrderStatus';
import { OrderStatus } from '@/types/orderDetailsModal';
import { toast } from 'sonner';

/**
 * Hook for managing order page state and operations
 */
export function useOrderPageHooks(orderId: string, adminEmail?: string) {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Core order data
  const { 
    data: orderData, 
    isLoading, 
    error, 
    refetch 
  } = useDetailedOrderData(orderId);

  // Status update hook
  const { updateStatus, isUpdating: isStatusUpdating } = useUpdateOrderStatus(orderId);

  // Dispatch riders query
  const { data: dispatchRiders, isLoading: isLoadingRiders } = useQuery({
    queryKey: ['dispatch-riders'],
    queryFn: getDispatchRiders,
    enabled: orderData?.order?.order_type === 'delivery'
  });

  // Generic order update mutation
  const updateOrderMutation = useMutation({
    mutationFn: updateOrder,
    onSuccess: () => {
      toast.success("Order updated successfully");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['detailed-order', orderId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
    onSettled: () => {
      setIsUpdating(false);
    }
  });

  // Rider assignment mutation
  const assignRiderMutation = useMutation({
    mutationFn: ({ orderId, riderId }: { orderId: string; riderId: string }) => 
      assignRiderToOrder(orderId, riderId),
    onSuccess: () => {
      toast.success("Rider assigned successfully");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['detailed-order', orderId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to assign rider: ${error.message}`);
    }
  });

  /**
   * Update order status with email notification
   */
  const handleStatusUpdate = useCallback(async (newStatus: OrderStatus) => {
    if (!orderData?.order) return false;

    setIsUpdating(true);
    
    try {
      const success = await updateStatus(newStatus);
      
      if (success && orderData.order.customer_email) {
        try {
          await sendOrderStatusEmailWithFallback({
            to: orderData.order.customer_email,
            orderData: orderData.order,
            status: newStatus,
            adminEmail: adminEmail || 'admin@starterssmallchops.com'
          });
          toast.success("Status updated and email sent!");
        } catch (emailError) {
          console.warn('Email failed but status updated:', emailError);
          toast.warning("Status updated but email failed to send");
        }
      }
      
      return success;
    } catch (error) {
      console.error('Status update failed:', error);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [orderData, updateStatus, adminEmail]);

  /**
   * Update order phone number
   */
  const handlePhoneUpdate = useCallback((newPhone: string) => {
    if (!newPhone.trim()) {
      toast.error("Phone number cannot be empty");
      return;
    }

    setIsUpdating(true);
    updateOrderMutation.mutate({
      orderId,
      updates: { customer_phone: newPhone }
    });
  }, [orderId, updateOrderMutation]);

  /**
   * Assign rider to order
   */
  const handleRiderAssignment = useCallback((riderId: string) => {
    if (!riderId) {
      toast.error("Please select a rider");
      return;
    }

    assignRiderMutation.mutate({ orderId, riderId });
  }, [orderId, assignRiderMutation]);

  /**
   * Update order with custom fields
   */
  const handleOrderUpdate = useCallback((updates: Record<string, any>) => {
    setIsUpdating(true);
    updateOrderMutation.mutate({
      orderId,
      updates
    });
  }, [orderId, updateOrderMutation]);

  /**
   * Print order details
   */
  const handlePrintOrder = useCallback(() => {
    try {
      window.print();
    } catch (error) {
      toast.error("Failed to print order");
      console.error('Print error:', error);
    }
  }, []);

  /**
   * Refresh order data
   */
  const refreshOrder = useCallback(async () => {
    try {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['detailed-order', orderId] });
      toast.success("Order refreshed");
    } catch (error) {
      toast.error("Failed to refresh order");
      console.error('Refresh error:', error);
    }
  }, [refetch, queryClient, orderId]);

  return {
    // Data
    orderData,
    dispatchRiders,
    
    // Loading states
    isLoading,
    isLoadingRiders,
    isUpdating: isUpdating || isStatusUpdating || updateOrderMutation.isPending || assignRiderMutation.isPending,
    
    // Error states
    error,
    
    // Actions
    handleStatusUpdate,
    handlePhoneUpdate,
    handleRiderAssignment,
    handleOrderUpdate,
    handlePrintOrder,
    refreshOrder,
    
    // Mutation objects (for advanced usage)
    updateOrderMutation,
    assignRiderMutation
  };
}

/**
 * Hook for bulk order operations
 */
export function useBulkOrderOperations() {
  const queryClient = useQueryClient();

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateOrders,
    onSuccess: (data) => {
      toast.success(`${data.updated_count || 0} orders updated successfully`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any) => {
      toast.error(`Bulk update failed: ${error.message}`);
    }
  });

  const handleBulkStatusUpdate = useCallback((orderIds: string[], status: OrderStatus) => {
    if (orderIds.length === 0) {
      toast.error("Please select orders to update");
      return;
    }

    bulkUpdateMutation.mutate(orderIds, { status });
  }, [bulkUpdateMutation]);

  const handleBulkRiderAssignment = useCallback((orderIds: string[], riderId: string) => {
    if (orderIds.length === 0) {
      toast.error("Please select orders to update");
      return;
    }

    if (!riderId) {
      toast.error("Please select a rider");
      return;
    }

    bulkUpdateMutation.mutate(orderIds, { assigned_rider_id: riderId });
  }, [bulkUpdateMutation]);

  return {
    // Loading state
    isBulkUpdating: bulkUpdateMutation.isPending,
    
    // Actions
    handleBulkStatusUpdate,
    handleBulkRiderAssignment,
    
    // Mutation object
    bulkUpdateMutation
  };
}

/**
 * Hook for order statistics and analytics
 */
export function useOrderStats(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['order-stats', dateRange],
    queryFn: async () => {
      // This would call an analytics API
      // For now, return mock data
      return {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        statusBreakdown: {} as Record<OrderStatus, number>
      };
    },
    enabled: false // Disable for now since we don't have the analytics API
  });
}