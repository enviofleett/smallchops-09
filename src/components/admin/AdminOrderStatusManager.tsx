import React, { useState, useCallback } from 'react';
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
    const timeSinceLastUpdate = getTimeSinceLastUpdate(orderId);
    
    if (isPending(orderId)) {
      toast.info('Update already in progress for this order');
      return;
    }

    if (timeSinceLastUpdate < 2000) {
      const remainingSeconds = Math.ceil((2000 - timeSinceLastUpdate) / 1000);
      toast.info(`Please wait ${remainingSeconds} seconds before updating again`);
      return;
    }

    setShowProcessing(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      onStatusUpdate?.(newStatus);
    } finally {
      setShowProcessing(false);
    }
  }, [updateOrderStatus, orderId, onStatusUpdate, isPending, getTimeSinceLastUpdate]);

  const handleSendDeliveryEmail = useCallback(() => {
    sendDeliveryEmailMutation.mutate(orderId);
  }, [sendDeliveryEmailMutation, orderId]);

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
    
    return (
      <div className={`flex gap-1 ${className}`}>
        {currentStatus === 'confirmed' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('preparing')}
            disabled={isDisabled}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                Processing...
              </>
            ) : isInDebounceWindow ? (
              <>
                <Clock className="w-4 h-4 mr-1" />
                Wait {remainingSeconds}s
              </>
            ) : (
              'Start Preparing'
            )}
          </Button>
        )}
        
        {currentStatus === 'preparing' && (
          <>
            <Button
              size={size}
              variant="outline"
              onClick={() => handleStatusUpdate('ready')}
              disabled={isDisabled}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  Processing...
                </>
              ) : isInDebounceWindow ? (
                <>
                  <Clock className="w-4 h-4 mr-1" />
                  Wait {remainingSeconds}s
                </>
              ) : (
                'Mark Ready'
              )}
            </Button>
          </>
        )}
        
        {currentStatus === 'out_for_delivery' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('delivered')}
            disabled={isDisabled}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                Processing...
              </>
            ) : isInDebounceWindow ? (
              <>
                <Clock className="w-4 h-4 mr-1" />
                Wait {remainingSeconds}s
              </>
            ) : (
              'Mark Delivered'
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