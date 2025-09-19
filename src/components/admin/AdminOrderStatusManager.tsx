import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEnhancedOrderStatusUpdate } from '@/hooks/useEnhancedOrderStatusUpdate';
import { OrderLockStatus } from './OrderLockStatus';
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
  lockInfo?: {
    is_locked: boolean;
    locking_admin_id?: string;
    locking_admin_name?: string;
    locking_admin_avatar?: string;
    locking_admin_email?: string;
    lock_expires_at?: string;
    seconds_remaining?: number;
    acquired_at?: string;
  };
}

export const AdminOrderStatusManager = ({ 
  orderId, 
  currentStatus, 
  orderNumber,
  className = '',
  size = 'sm',
  onStatusUpdate,
  lockInfo
}: AdminOrderStatusManagerProps) => {
  const queryClient = useQueryClient();
  
  
  // Use enhanced hook with idempotency and distributed locking
  const { 
    updateOrderStatus, 
    isUpdating, 
    error,
    adminUserId,
    isPending,
    getTimeSinceLastUpdate 
  } = useEnhancedOrderStatusUpdate();
  
  // Check if order is locked by another admin
  const isLockedByOther = Boolean(
    lockInfo?.is_locked && 
    lockInfo?.locking_admin_id && 
    lockInfo?.locking_admin_id !== adminUserId // Compare with current admin user ID
  );
  
  // Check if current admin is the lock holder
  const isLockHolder = Boolean(
    lockInfo?.is_locked && 
    lockInfo?.locking_admin_id && 
    lockInfo?.locking_admin_id === adminUserId
  );
  
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

    // Skip timing restrictions for lock holders
    if (!isLockHolder && timeSinceLastUpdate < 2000) {
      const remainingSeconds = Math.ceil((2000 - timeSinceLastUpdate) / 1000);
      toast.info(`Please wait ${remainingSeconds} seconds before updating again`);
      return;
    }

    // Implement timing logic based on lock status
    const debounceTime = isLockHolder ? 0 : 2000; // No delay for lock holders
    const timeoutId = setTimeout(async () => {
      setShowProcessing(true);
      try {
        await updateOrderStatus(orderId, newStatus, isLockHolder); // Skip debounce for lock holders
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
    }, debounceTime);

    setDebounceTimeout(timeoutId);
    setShowProcessing(true);
    
    if (isLockHolder) {
      toast.info(`Updating status to ${newStatus.replace('_', ' ')}...`);
    } else {
      toast.info(`Scheduling status change to ${newStatus.replace('_', ' ')}...`);
    }
  }, [updateOrderStatus, orderId, onStatusUpdate, isPending, getTimeSinceLastUpdate, debounceTimeout, isLockHolder]);

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
    // Show lock status message if locked by another admin
    if (isLockedByOther) {
      return (
        <div className="text-sm text-muted-foreground italic flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Order is being updated by {lockInfo?.locking_admin_name || 'another admin'}
        </div>
      );
    }

    const isProcessing = isUpdating || sendDeliveryEmailMutation.isPending || showProcessing;
    const isOrderPending = isPending(orderId);
    const timeSinceLastUpdate = getTimeSinceLastUpdate(orderId);
    const isInDebounceWindow = !isLockHolder && timeSinceLastUpdate < 2000; // Skip debounce window for lock holders
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
    <div className="flex flex-col gap-2">
      {/* Lock Status Display */}
      {lockInfo?.is_locked && (
        <div className="bg-muted/30 rounded-lg p-2">
          <OrderLockStatus
            orderId={orderId}
            lockInfo={lockInfo}
            size="sm"
          />
        </div>
      )}
      
      {/* Status and Actions */}
      <div className="flex items-center gap-2">
        {renderStatusBadge()}
        {renderActionButtons()}
      </div>
    </div>
  );
};