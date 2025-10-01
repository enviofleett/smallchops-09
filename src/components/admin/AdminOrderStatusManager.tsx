import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { OrderStatus } from '@/types/orders';
import { RefreshCw, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaymentConfirmationButton } from './PaymentConfirmationButton';

interface AdminOrderStatusManagerProps {
  orderId: string;
  currentStatus: OrderStatus;
  orderNumber: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  onStatusUpdate?: (newStatus: OrderStatus) => void;
}

export const AdminOrderStatusManager = ({ 
  orderId, 
  currentStatus, 
  orderNumber,
  paymentStatus,
  paymentReference,
  className = '',
  size = 'sm',
  onStatusUpdate
}: AdminOrderStatusManagerProps) => {
  const queryClient = useQueryClient();
  const { updateStatus, isUpdating, error } = useProductionStatusUpdate();

  // Secure email notification mutation using edge function
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

  const handleStatusUpdate = (newStatus: OrderStatus) => {
    updateStatus({ orderId, status: newStatus });
    onStatusUpdate?.(newStatus);
  };

  const handleSendDeliveryEmail = () => {
    sendDeliveryEmailMutation.mutate(orderId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'out_for_delivery': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'confirmed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderStatusBadge = () => (
    <Badge 
      variant="outline" 
      className={`${getStatusColor(currentStatus)} capitalize font-medium`}
    >
      {currentStatus.replace('_', ' ')}
    </Badge>
  );

  const renderActionButtons = () => {
    const isProcessing = isUpdating || sendDeliveryEmailMutation.isPending;
    
    return (
      <div className={`flex gap-1 ${className}`}>
        {/* Confirmed -> Preparing */}
        {currentStatus === 'confirmed' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('preparing')}
            disabled={isProcessing}
          >
            {isUpdating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Start Preparing'
            )}
          </Button>
        )}

        {/* Preparing -> Ready + Send Email */}
        {currentStatus === 'preparing' && (
          <>
            <Button
              size={size}
              variant="outline"
              onClick={() => handleStatusUpdate('ready')}
              disabled={isProcessing}
            >
              {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mark Ready'}
            </Button>
            <Button
              size={size}
              variant="outline"
              onClick={handleSendDeliveryEmail}
              disabled={isProcessing}
              title="Send out-for-delivery email"
            >
              {sendDeliveryEmailMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </>
        )}

        {/* Ready -> Out for Delivery */}
        {currentStatus === 'ready' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => {
              handleStatusUpdate('out_for_delivery');
              handleSendDeliveryEmail();
            }}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Out for Delivery
              </>
            )}
          </Button>
        )}

        {/* Out for Delivery -> Delivered */}
        {currentStatus === 'out_for_delivery' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('delivered')}
            disabled={isProcessing}
          >
            {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mark Delivered'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {renderStatusBadge()}
        {renderActionButtons()}
      </div>
      {paymentStatus && paymentReference && (
        <PaymentConfirmationButton
          orderId={orderId}
          orderNumber={orderNumber}
          paymentReference={paymentReference}
          paymentStatus={paymentStatus}
          onSuccess={() => onStatusUpdate?.('confirmed' as OrderStatus)}
        />
      )}
    </div>
  );
};