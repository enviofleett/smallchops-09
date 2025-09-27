import React from 'react';
import { Badge } from '@/components/ui/badge';
import { OrderStatus } from '@/types/orderDetailsModal';

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          className: 'bg-warning/20 text-warning-foreground border-warning/30',
          label: 'Pending',
        };
      case 'confirmed':
        return {
          className: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
          label: 'Confirmed',
        };
      case 'preparing':
        return {
          className: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
          label: 'Preparing',
        };
      case 'ready':
        return {
          className: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
          label: 'Ready',
        };
      case 'out_for_delivery':
        return {
          className: 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
          label: 'Out for Delivery',
        };
      case 'delivered':
        return {
          className: 'bg-success/20 text-success-foreground border-success/30',
          label: 'Delivered',
        };
      case 'completed':
        return {
          className: 'bg-success/20 text-success-foreground border-success/30',
          label: 'Completed',
        };
      case 'cancelled':
        return {
          className: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
          label: 'Cancelled',
        };
      case 'refunded':
        return {
          className: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
          label: 'Refunded',
        };
      case 'returned':
        return {
          className: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
          label: 'Returned',
        };
      default:
        return {
          className: 'bg-muted text-muted-foreground border-border',
          label: status,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${className || ''}`}
    >
      {config.label}
    </Badge>
  );
};