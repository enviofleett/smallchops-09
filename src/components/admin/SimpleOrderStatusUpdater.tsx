import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSimpleStatusUpdate } from '@/hooks/useSimpleStatusUpdate';
import { OrderStatus } from '@/types/orders';
import { RefreshCw } from 'lucide-react';

interface SimpleOrderStatusUpdaterProps {
  orderId: string;
  currentStatus: OrderStatus;
  orderNumber: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  onStatusUpdate?: (newStatus: OrderStatus) => void;
}

export const SimpleOrderStatusUpdater = ({ 
  orderId, 
  currentStatus, 
  orderNumber,
  className = '',
  size = 'sm',
  onStatusUpdate
}: SimpleOrderStatusUpdaterProps) => {
  const { updateStatus, isUpdating } = useSimpleStatusUpdate();

  const handleStatusUpdate = (newStatus: OrderStatus) => {
    updateStatus({ orderId, status: newStatus });
    onStatusUpdate?.(newStatus);
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
    return (
      <div className={`flex gap-1 ${className}`}>
        {/* Confirmed -> Preparing */}
        {currentStatus === 'confirmed' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('preparing')}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Start Preparing'
            )}
          </Button>
        )}

        {/* Preparing -> Ready */}
        {currentStatus === 'preparing' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('ready')}
            disabled={isUpdating}
          >
            {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mark Ready'}
          </Button>
        )}

        {/* Ready -> Out for Delivery */}
        {currentStatus === 'ready' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('out_for_delivery')}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Out for Delivery'
            )}
          </Button>
        )}

        {/* Out for Delivery -> Delivered */}
        {currentStatus === 'out_for_delivery' && (
          <Button
            size={size}
            variant="outline"
            onClick={() => handleStatusUpdate('delivered')}
            disabled={isUpdating}
          >
            {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Mark Delivered'}
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