import React from 'react';
import { Printer, Copy, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order, OrderStatus } from '@/types/orderDetailsModal';
import { usePrint } from '@/hooks/usePrint';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useUpdateOrderStatus } from '@/hooks/useUpdateOrderStatus';
import { StatusBadge } from './StatusBadge';

interface ActionsSectionProps {
  order: Order;
  printRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  onStatusUpdate: () => void;
  isUpdatingStatus: boolean;
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ActionsSection: React.FC<ActionsSectionProps> = ({
  order,
  printRef,
  onClose,
  onStatusUpdate,
  isUpdatingStatus,
}) => {
  const { handlePrint } = usePrint(printRef, `Order-${order.order_number}`);
  const { copyToClipboard, isCopying } = useCopyToClipboard();
  const { updateStatus, isUpdating } = useUpdateOrderStatus(order.id);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === order.status) return;
    
    const success = await updateStatus(newStatus);
    if (success) {
      onStatusUpdate();
    }
  };

  const handleCopyOrderNumber = async () => {
    await copyToClipboard(
      order.order_number,
      `Order number ${order.order_number} copied to clipboard`
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
      {/* Status Update */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          Change Status:
        </span>
        <Select
          value={order.status}
          onValueChange={handleStatusChange}
          disabled={isUpdating || isUpdatingStatus}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status.value} />
                  <span>{status.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {(isUpdating || isUpdatingStatus) && (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyOrderNumber}
          disabled={isCopying}
          className="flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          {isCopying ? 'Copying...' : 'Copy #'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </div>
  );
};