import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEnhancedOrderStatusUpdate } from '@/hooks/useEnhancedOrderStatusUpdate';
import { OrderStatus } from '@/types/orders';
import { RefreshCw, Send, Clock, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminOrderStatusManagerProps {
  orderId: string;
  currentStatus: OrderStatus;
  orderNumber: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  onStatusUpdate?: (newStatus: OrderStatus) => void;
}

export const AdminOrderStatusManager = ({ 
  orderId, 
  currentStatus, 
  orderNumber,
  className = '',
  size = 'sm',
  onStatusUpdate
}: AdminOrderStatusManagerProps) => {
  const queryClient = useQueryClient();
  
  // Use enhanced hook with idempotency and distributed locking
  const { 
    updateOrderStatus, 
    isUpdating, 
    error,
    sessionId,
    isPending,
    getTimeSinceLastUpdate 
  } = useEnhancedOrderStatusUpdate();
  
  const [showProcessing, setShowProcessing] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  // Secure email notification mutation
  const sendDeliveryEmailMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('send-out-for-delivery-email', {
        body: { order_id: orderId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Out-for-delivery notification sent to customer.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send delivery notification.');
    }
  });

  const handleStatusUpdate = useCallback(async (newStatus: OrderStatus) => {
    // Clear any existing debounce timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      setDebounceTimeout(null);
    }

    const timeSinceLastUpdate = getTimeSinceLastUpdate(orderId);
    
    if (isPending(orderId)) {
      toast.info('Another admin is currently updating this order. Please wait...');
      return;
    }

    if (timeSinceLastUpdate < 2000) {
      const remainingSeconds = Math.ceil((2000 - timeSinceLastUpdate) / 1000);
      toast.info(`Please wait ${remainingSeconds} seconds before updating again`);
      return;
    }

    // Implement 2-second debouncing for rapid status changes
    const timeoutId = setTimeout(async () => {
      setShowProcessing(true);
      try {
        await updateOrderStatus(orderId, newStatus);
        onStatusUpdate?.(newStatus);
        toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
      } catch (error: any) {
        // Enhanced error messages for different error types
        if (error.message?.includes('409') || error.message?.includes('conflict')) {
          toast.error('Another admin is updating this order. Please try again in a moment.');
        } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
          toast.error('Session expired. Please refresh and try again.');
        } else if (error.message?.includes('Network')) {
          toast.error('Network error. Retrying in 3 seconds...');
          // Auto-retry for network errors
          setTimeout(() => handleStatusUpdate(newStatus), 3000);
        } else {
          toast.error(`Failed to update status: ${error.message || 'Unknown error'}`);
        }
      } finally {
        setShowProcessing(false);
        setDebounceTimeout(null);
      }
    }, 2000);

    setDebounceTimeout(timeoutId);
    setShowProcessing(true);
    toast.info(`Scheduling status change to ${newStatus.replace('_', ' ')}...`);
  }, [updateOrderStatus, orderId, onStatusUpdate, isPending, getTimeSinceLastUpdate, debounceTimeout]);

  const handleSendDeliveryEmail = useCallback(() => {
    sendDeliveryEmailMutation.mutate(orderId);
  }, [sendDeliveryEmailMutation, orderId]);

  // Status transition validation
  const isValidTransition = (from: OrderStatus, to: OrderStatus): boolean => {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: ['completed', 'returned'],
      cancelled: ['pending'],
      refunded: [],
      completed: [],
      returned: ['refunded']
    };
    
    return validTransitions[from]?.includes(to) || false;
  };

  const getStatusColor = (status: OrderStatus): string => {
    const colorMap: Record<OrderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-orange-100 text-orange-800',
      ready: 'bg-green-100 text-green-800',
      out_for_delivery: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-500 text-white',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
      completed: 'bg-green-600 text-white',
      returned: 'bg-red-200 text-red-900'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const renderStatusBadge = () => (
    <Badge className={getStatusColor(currentStatus)}>
      {currentStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </Badge>
  );

  const renderActionButtons = () => {
    const isProcessing = isUpdating || sendDeliveryEmailMutation.isPending || showProcessing;
    const isOrderPending = isPending(orderId);
    const timeSinceLastUpdate = getTimeSinceLastUpdate(orderId);
    const isInDebounceWindow = timeSinceLastUpdate < 2000;
    const isDisabled = isProcessing || isOrderPending || isInDebounceWindow;
    const remainingSeconds = isInDebounceWindow ? Math.ceil((2000 - timeSinceLastUpdate) / 1000) : 0;
    
    const getNextValidStatuses = (): OrderStatus[] => {
      const validNext: Record<OrderStatus, OrderStatus[]> = {
        pending: ['confirmed'],
        confirmed: ['preparing'],
        preparing: ['ready'],
        ready: ['out_for_delivery'],
        out_for_delivery: ['delivered'],
        delivered: ['completed'],
        cancelled: [],
        refunded: [],
        completed: [],
        returned: ['refunded']
      };
      return validNext[currentStatus] || [];
    };

    const validNextStatuses = getNextValidStatuses();
    
    return (
      <div className={`flex gap-1 ${className}`}>
        {validNextStatuses.map(nextStatus => {
          const isValidNext = isValidTransition(currentStatus, nextStatus);
          
          return (
            <Button
              key={nextStatus}
              size={size}
              variant="outline"
              onClick={() => handleStatusUpdate(nextStatus)}
              disabled={isDisabled || !isValidNext}
              className={!isValidNext ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  {debounceTimeout ? 'Scheduling...' : 'Processing...'}
                </>
              ) : isInDebounceWindow ? (
                <>
                  <Clock className="w-4 h-4 mr-1" />
                  Wait {remainingSeconds}s
                </>
              ) : error ? (
                <>
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Retry
                </>
              ) : (
                `Mark ${nextStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
              )}
            </Button>
          );
        })}
        
        {/* Cancel button for most statuses */}
        {!['delivered', 'completed', 'cancelled', 'refunded'].includes(currentStatus) && (
          <Button
            size={size}
            variant="destructive"
            onClick={() => handleStatusUpdate('cancelled')}
            disabled={isDisabled}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                Cancelling...
              </>
            ) : (
              'Cancel Order'
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {renderStatusBadge()}
      {renderActionButtons()}
    </div>
  );
};