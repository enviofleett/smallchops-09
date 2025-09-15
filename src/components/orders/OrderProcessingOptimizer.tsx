import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { OrderWithItems, updateOrder } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { useOrderErrorHandler } from './OrderManagementErrorBoundary';

interface OrderProcessingOptimizerProps {
  children: (optimizedHandlers: OptimizedOrderHandlers) => React.ReactNode;
}

interface OptimizedOrderHandlers {
  updateOrderOptimized: (orderId: string, updates: any) => Promise<void>;
  isProcessing: (orderId: string) => boolean;
  getProcessingStatus: (orderId: string) => ProcessingStatus;
}

interface ProcessingStatus {
  isLoading: boolean;
  attempts: number;
  lastError?: string;
  canRetry: boolean;
}

export const OrderProcessingOptimizer: React.FC<OrderProcessingOptimizerProps> = ({ 
  children 
}) => {
  const queryClient = useQueryClient();
  const { handleError } = useOrderErrorHandler();
  const processingRef = useRef(new Map<string, ProcessingStatus>());
  const [processingStates, setProcessingStates] = useState<Map<string, ProcessingStatus>>(
    new Map()
  );

  // Debounced update to prevent rapid consecutive updates
  const debouncedUpdateRef = useRef(new Map<string, NodeJS.Timeout>());

  const updateProcessingState = useCallback((orderId: string, status: Partial<ProcessingStatus>) => {
    setProcessingStates(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(orderId) || { isLoading: false, attempts: 0, canRetry: true };
      newMap.set(orderId, { ...current, ...status });
      processingRef.current = newMap;
      return newMap;
    });
  }, []);

  const updateOrderOptimized = useCallback(async (
    orderId: string, 
    updates: any
  ): Promise<void> => {
    // Clear any existing debounced update for this order
    const existingTimeout = debouncedUpdateRef.current.get(orderId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Check if order is already being processed
    const currentState = processingRef.current.get(orderId);
    if (currentState?.isLoading) {
      toast.warning('Order is already being updated. Please wait...');
      return;
    }

    // Set processing state
    updateProcessingState(orderId, { 
      isLoading: true, 
      attempts: (currentState?.attempts || 0) + 1,
      lastError: undefined 
    });

    try {
      // Optimistic update - update the cache immediately
      queryClient.setQueryData(
        ['orders'],
        (oldData: any) => {
          if (!oldData?.orders) return oldData;
          
          return {
            ...oldData,
            orders: oldData.orders.map((order: OrderWithItems) =>
              order.id === orderId 
                ? { ...order, ...updates, updated_at: new Date().toISOString() }
                : order
            )
          };
        }
      );

      // Perform the actual update
      await updateOrder(orderId, updates);

      // Update successful
      updateProcessingState(orderId, { 
        isLoading: false, 
        canRetry: true 
      });

      // Invalidate and refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Success toast
      const statusUpdate = updates.status;
      if (statusUpdate) {
        toast.success(`Order status updated to ${statusUpdate}`);
      } else {
        toast.success('Order updated successfully');
      }

    } catch (error: any) {
      console.error('Order update failed:', error);

      // Handle the error and get user-friendly message
      const { message, isRetryable } = handleError(error, 'Order Update');

      // Revert optimistic update on failure
      await queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Update processing state with error
      updateProcessingState(orderId, { 
        isLoading: false, 
        lastError: message,
        canRetry: isRetryable 
      });

      // Show error toast
      toast.error(message);

      // If retryable, offer retry option
      if (isRetryable && (currentState?.attempts || 0) < 3) {
        toast.error(message, {
          action: {
            label: 'Retry',
            onClick: () => updateOrderOptimized(orderId, updates)
          }
        });
      }

      throw error; // Re-throw for component handling
    }
  }, [queryClient, handleError, updateProcessingState]);

  const isProcessing = useCallback((orderId: string): boolean => {
    return processingRef.current.get(orderId)?.isLoading || false;
  }, []);

  const getProcessingStatus = useCallback((orderId: string): ProcessingStatus => {
    return processingRef.current.get(orderId) || { 
      isLoading: false, 
      attempts: 0, 
      canRetry: true 
    };
  }, []);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      debouncedUpdateRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const optimizedHandlers: OptimizedOrderHandlers = {
    updateOrderOptimized,
    isProcessing,
    getProcessingStatus
  };

  return <>{children(optimizedHandlers)}</>;
};

// Hook for using the optimizer in functional components
export const useOrderProcessingOptimizer = () => {
  const [optimizer, setOptimizer] = React.useState<OptimizedOrderHandlers | null>(null);

  return {
    OrderProcessingProvider: React.useCallback(({ children }: { children: React.ReactNode }) => (
      <OrderProcessingOptimizer>
        {(handlers) => {
          // Update the optimizer reference
          React.useEffect(() => {
            setOptimizer(handlers);
          }, [handlers]);
          
          return <>{children}</>;
        }}
      </OrderProcessingOptimizer>
    ), []),
    optimizer
  };
};

// Utility hook for batch operations
export const useBatchOrderOperations = () => {
  const queryClient = useQueryClient();
  const { handleError } = useOrderErrorHandler();

  const batchUpdateOrders = useCallback(async (
    updates: Array<{ orderId: string; updates: any }>
  ) => {
    const results = {
      successful: [] as string[],
      failed: [] as { orderId: string; error: string }[]
    };

    // Process updates in batches of 5 to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async ({ orderId, updates: orderUpdates }) => {
        try {
          await updateOrder(orderId, orderUpdates);
          results.successful.push(orderId);
        } catch (error: any) {
          const { message } = handleError(error, `Batch Update Order ${orderId}`);
          results.failed.push({ orderId, error: message });
        }
      });

      await Promise.allSettled(batchPromises);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Refresh orders after batch operation
    await queryClient.invalidateQueries({ queryKey: ['orders'] });

    // Show results
    if (results.successful.length > 0) {
      toast.success(`${results.successful.length} orders updated successfully`);
    }
    
    if (results.failed.length > 0) {
      toast.error(`${results.failed.length} orders failed to update`);
    }

    return results;
  }, [queryClient, handleError]);

  return { batchUpdateOrders };
};