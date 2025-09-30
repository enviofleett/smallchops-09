import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { OrderStatus } from '@/types/orders';
import { RefreshCw, Send } from 'lucide-react';
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
  const { updateStatus } = useProductionStatusUpdate();

  // --- Optimistic UI state ---
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- Handle status update (optimistic UI) ---
  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (isUpdating || newStatus === currentStatus) return;

    const prevStatus = selectedStatus;
    setSelectedStatus(newStatus); // Optimistic update
    setIsUpdating(true);

    try {
      await updateStatus({ orderId, status: newStatus });
      toast.success('Order status updated!');
      queryClient.invalidateQueries(['order', orderId]);
      if (onStatusUpdate) onStatusUpdate(newStatus);
    } catch (err) {
      setSelectedStatus(prevStatus); // Rollback UI
      toast.error('Failed to update status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // If the currentStatus prop changes (e.g., after refetch), sync selectedStatus
  React.useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  const statusOptions: OrderStatus[] = [
    'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'
  ];

  function getStatusLabel(status: OrderStatus) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className={`space-y-2 ${className}`}> 
      <label className="text-sm font-medium text-muted-foreground">
        Update Status for Order #{orderNumber}
      </label>
      <div className="flex gap-2">
        <select
          value={selectedStatus}
          onChange={e => handleStatusUpdate(e.target.value as OrderStatus)}
          disabled={isUpdating}
          className="w-full p-2 border rounded-md bg-background"
        >
          {statusOptions.map(status => (
            <option key={status} value={status} disabled={status === currentStatus}>
              {getStatusLabel(status)}{status === currentStatus ? ' (Current)' : ''}
            </option>
          ))}
        </select>
        {isUpdating && (
          <RefreshCw className="w-4 h-4 animate-spin ml-2" />
        )}
      </div>
      <div>
        <Badge>{getStatusLabel(selectedStatus)}</Badge>
      </div>
    </div>
  );
};