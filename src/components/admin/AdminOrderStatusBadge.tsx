
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getStatusColor } from '@/utils/statusColors';

interface AdminOrderStatusBadgeProps {
  status: string;
  className?: string;
}

export const AdminOrderStatusBadge = ({ status, className = '' }: AdminOrderStatusBadgeProps) => {
  const statusDisplay = status?.replace(/_/g, ' ') || 'Unknown'; // Replace all underscores
  const colorClasses = getStatusColor(status);
  
  return (
    <Badge 
      variant="outline" 
      className={`${colorClasses} ${className} capitalize font-medium`}
    >
      {statusDisplay}
    </Badge>
  );
};
